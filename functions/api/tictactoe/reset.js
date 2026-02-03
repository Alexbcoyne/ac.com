// Reset the game

export async function onRequest(context) {
  const { request, env } = context;
  
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { 
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }
  
  try {
    // Get current stats
    const gameData = await env.TICTACTOE_KV.get('current_game');
    const oldGame = gameData ? JSON.parse(gameData) : null;
    
    // Create new game with preserved stats
    const newGame = {
      board: ['', '', '', '', '', '', '', '', ''],
      currentTurn: 'world',
      status: 'active',
      lastMove: Date.now(),
      moveHistory: [],
      stats: oldGame?.stats || { alexWins: 0, worldWins: 0, draws: 0 }
    };
    
    await env.TICTACTOE_KV.put('current_game', JSON.stringify(newGame));
    
    return new Response(JSON.stringify(newGame), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
