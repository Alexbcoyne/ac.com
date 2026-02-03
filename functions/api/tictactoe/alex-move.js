// Alex's move endpoint (called from Slack)

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    const { position } = await request.json();
    
    if (typeof position !== 'number' || position < 0 || position > 8) {
      return new Response(JSON.stringify({ error: 'Invalid position (0-8)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Get current game
    const gameData = await env.TICTACTOE_KV.get('current_game');
    if (!gameData) {
      return new Response(JSON.stringify({ error: 'No active game' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    const game = JSON.parse(gameData);
    
    // Validate move
    if (game.currentTurn !== 'alex') {
      return new Response(JSON.stringify({ error: "It's The World's turn!" }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (game.board[position] !== '') {
      return new Response(JSON.stringify({ error: 'Cell already taken' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (game.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Game is not active' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Make Alex's move
    game.board[position] = 'X'; // Alex plays X
    game.currentTurn = 'world';
    game.lastMove = Date.now();
    game.moveHistory.push({ player: 'alex', position, timestamp: Date.now() });
    
    // Check for win/draw
    const result = checkGameResult(game.board);
    if (result) {
      game.status = result;
      if (result === 'alexWon') game.stats.alexWins++;
      else if (result === 'draw') game.stats.draws++;
    }
    
    // Save game
    await env.TICTACTOE_KV.put('current_game', JSON.stringify(game));
    
    return new Response(JSON.stringify(game), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Check win/draw conditions
function checkGameResult(board) {
  const winPatterns = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
    [0, 4, 8], [2, 4, 6] // diagonals
  ];
  
  for (const pattern of winPatterns) {
    const [a, b, c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] === 'X' ? 'alexWon' : 'worldWon';
    }
  }
  
  // Check for draw
  if (board.every(cell => cell !== '')) {
    return 'draw';
  }
  
  return null;
}
