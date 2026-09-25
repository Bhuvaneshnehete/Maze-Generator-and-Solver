(function(){
  const canvas = document.getElementById('maze');
  const ctx = canvas.getContext('2d');
  const sizeSlider = document.getElementById('sizeSlider');
  const sizeLabel = document.getElementById('sizeLabel');
  const speedSlider = document.getElementById('speedSlider');
  const generateBtn = document.getElementById('generateBtn');
  const solveBtn = document.getElementById('solveBtn');
  const statusEl = document.getElementById('status');

  const COLORS = {
    wall: '#2f2a24',
    bg: '#eae3d3',
    visited: 'rgba(92,107,79,0.35)',   // moss, exploration trail
    frontier: 'rgba(169,132,60,0.55)', // gold, current frontier
    path: '#b0432a',                   // thread, final solution
    start: '#5c6b4f',
    end: '#b0432a'
  };

  let cols = 20, rows = 20;
  let cellSize = 30;
  let grid = [];       // grid[r][c] = {walls:{N,E,S,W}, visited}
  let solving = false;
  let animId = null;

  function makeGrid(c, r){
    const g = [];
    for(let y=0;y<r;y++){
      const row = [];
      for(let x=0;x<c;x++){
        row.push({N:true,E:true,S:true,W:true, visited:false});
      }
      g.push(row);
    }
    return g;
  }

  function resizeCanvas(){
    const maxDim = 640;
    cellSize = Math.floor(maxDim / Math.max(cols, rows));
    canvas.width = cellSize * cols;
    canvas.height = cellSize * rows;
  }

  // Recursive backtracker maze generation (iterative with stack)
  function generateMaze(){
    grid = makeGrid(cols, rows);
    const stack = [];
    let cx = 0, cy = 0;
    grid[cy][cx].visited = true;
    stack.push([cx,cy]);

    while(stack.length){
      const [x,y] = stack[stack.length-1];
      const neighbors = [];
      if(y>0 && !grid[y-1][x].visited) neighbors.push(['N',x,y-1]);
      if(x<cols-1 && !grid[y][x+1].visited) neighbors.push(['E',x+1,y]);
      if(y<rows-1 && !grid[y+1][x].visited) neighbors.push(['S',x,y+1]);
      if(x>0 && !grid[y][x-1].visited) neighbors.push(['W',x-1,y]);

      if(neighbors.length === 0){
        stack.pop();
        continue;
      }
      const [dir, nx, ny] = neighbors[Math.floor(Math.random()*neighbors.length)];
      const opposite = {N:'S',S:'N',E:'W',W:'E'};
      grid[y][x][dir] = false;
      grid[ny][nx][opposite[dir]] = false;
      grid[ny][nx].visited = true;
      stack.push([nx,ny]);
    }
    // reset visited flag (was used only for generation)
    for(let y=0;y<rows;y++) for(let x=0;x<cols;x++) grid[y][x].visited = false;
  }

  function drawMaze(){
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0,0,canvas.width, canvas.height);

    ctx.strokeStyle = COLORS.wall;
    ctx.lineWidth = Math.max(2, cellSize*0.08);
    ctx.lineCap = 'square';

    ctx.beginPath();
    for(let y=0;y<rows;y++){
      for(let x=0;x<cols;x++){
        const cell = grid[y][x];
        const px = x*cellSize, py = y*cellSize;
        if(cell.N){ ctx.moveTo(px,py); ctx.lineTo(px+cellSize,py); }
        if(cell.E){ ctx.moveTo(px+cellSize,py); ctx.lineTo(px+cellSize,py+cellSize); }
        if(cell.S){ ctx.moveTo(px,py+cellSize); ctx.lineTo(px+cellSize,py+cellSize); }
        if(cell.W){ ctx.moveTo(px,py); ctx.lineTo(px,py+cellSize); }
      }
    }
    ctx.stroke();

    // outer border a touch heavier
    ctx.lineWidth = Math.max(3, cellSize*0.1);
    ctx.strokeRect(1,1,canvas.width-2, canvas.height-2);

    drawMarker(0,0, COLORS.start);
    drawMarker(cols-1, rows-1, COLORS.end);
  }

  function drawMarker(cx, cy, color){
    const px = cx*cellSize + cellSize/2;
    const py = cy*cellSize + cellSize/2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(px, py, cellSize*0.28, 0, Math.PI*2);
    ctx.fill();
  }

  function cellCenter(x,y){
    return [x*cellSize+cellSize/2, y*cellSize+cellSize/2];
  }

  function fillCell(x,y,color, scale){
    scale = scale || 0.62;
    const px = x*cellSize + cellSize*(1-scale)/2;
    const py = y*cellSize + cellSize*(1-scale)/2;
    ctx.fillStyle = color;
    ctx.fillRect(px,py, cellSize*scale, cellSize*scale);
  }

  function neighborsOf(x,y){
    const cell = grid[y][x];
    const list = [];
    if(!cell.N) list.push([x,y-1]);
    if(!cell.E) list.push([x+1,y]);
    if(!cell.S) list.push([x,y+1]);
    if(!cell.W) list.push([x-1,y]);
    return list;
  }

  // BFS solve, animated step by step
  function solveMaze(){
    if(solving) return;
    solving = true;
    solveBtn.disabled = true;
    generateBtn.disabled = true;
    statusEl.textContent = 'Searching for the path...';

    const start = [0,0];
    const end = [cols-1, rows-1];
    const key = (x,y)=> x+','+y;

    const cameFrom = new Map();
    const visited = new Set([key(...start)]);
    const queue = [start];
    let qi = 0;

    const speed = parseInt(speedSlider.value,10);
    const stepsPerFrame = Math.max(1, speed*speed); // exploration speed scales

    function endReached(){
      return visited.has(key(end[0], end[1])) && cameFrom.has(key(end[0],end[1]));
    }

    function stepBFS(){
      let progressed = 0;

      while(qi < queue.length && progressed < stepsPerFrame){
        const [x,y] = queue[qi];
        qi++;
        progressed++;

        if(x===end[0] && y===end[1]){ break; }

        for(const [nx,ny] of neighborsOf(x,y)){
          const k = key(nx,ny);
          if(!visited.has(k)){
            visited.add(k);
            cameFrom.set(k, [x,y]);
            queue.push([nx,ny]);
            fillCell(nx,ny, COLORS.visited, 0.5);
          }
        }
      }

      if(endReached()){
        finishSolve(cameFrom, key, start, end);
        return;
      }
      if(qi >= queue.length){
        statusEl.textContent = 'No path exists in this maze — that should never happen. Try generating a new one.';
        solving = false;
        solveBtn.disabled = false;
        generateBtn.disabled = false;
        return;
      }
      animId = requestAnimationFrame(stepBFS);
    }

    // redraw base maze first (in case of previous solve overlay), then animate BFS on top
    drawMaze();
    animId = requestAnimationFrame(stepBFS);

    function finishSolve(cameFrom, key, start, end){
      // reconstruct path
      const path = [];
      const startKey = key(start[0], start[1]);
      let node = end;
      path.push(node);
      while(key(node[0],node[1]) !== startKey){
        node = cameFrom.get(key(node[0],node[1]));
        if(!node) break;
        path.push(node);
      }
      path.reverse();
      animatePath(path);
    }

    function animatePath(path){
      let i = 0;
      ctx.lineWidth = Math.max(3, cellSize*0.28);
      ctx.strokeStyle = COLORS.path;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      const [sx,sy] = cellCenter(path[0][0], path[0][1]);
      ctx.moveTo(sx,sy);

      function drawSegment(){
        if(i >= path.length-1){
          drawMarker(0,0, COLORS.start);
          drawMarker(cols-1, rows-1, COLORS.end);
          statusEl.innerHTML = `Solved — the path is <b>${path.length-1}</b> steps long.`;
          solving = false;
          solveBtn.disabled = false;
          generateBtn.disabled = false;
          return;
        }
        const stepsThisFrame = Math.max(1, Math.floor(speed/2));
        for(let s=0; s<stepsThisFrame && i < path.length-1; s++){
          i++;
          const [px,py] = cellCenter(path[i][0], path[i][1]);
          ctx.lineTo(px,py);
        }
        ctx.stroke();
        animId = requestAnimationFrame(drawSegment);
      }
      drawSegment();
    }
  }

  function stopSolving(){
    if(animId) cancelAnimationFrame(animId);
    solving = false;
    solveBtn.disabled = false;
    generateBtn.disabled = false;
  }

  function newMaze(){
    stopSolving();
    cols = rows = parseInt(sizeSlider.value,10);
    resizeCanvas();
    generateMaze();
    drawMaze();
    statusEl.textContent = 'Fresh labyrinth carved. Press "Solve It" to watch the search unfold.';
  }

  sizeSlider.addEventListener('input', ()=>{
    sizeLabel.textContent = `${sizeSlider.value} × ${sizeSlider.value}`;
  });
  sizeSlider.addEventListener('change', newMaze);
  generateBtn.addEventListener('click', newMaze);
  solveBtn.addEventListener('click', solveMaze);

  // init
  sizeLabel.textContent = `${sizeSlider.value} × ${sizeSlider.value}`;
  newMaze();
})();