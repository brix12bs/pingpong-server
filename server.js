const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(express.static(__dirname));

let games = {};

io.on('connection', (socket) => {
    socket.on('joinGame', () => {
        let gameId = null;
        for (const id in games) {
            if (games[id].players.length < 2) {
                gameId = id;
                break;
            }
        }
        if (!gameId) {
            gameId = Date.now().toString();
            games[gameId] = {
                players: [],
                ball: { x: 300, y: 200, dx: 5, dy: -5 },
                scores: { player1: 0, player2: 0 }
            };
        }
        games[gameId].players.push(socket.id);
        socket.join(gameId);
        socket.emit('gameId', gameId);

        if (games[id].players.length === 2) {
            io.to(gameId).emit('startGame');
            updateGame(gameId);
        }
    });

    socket.on('movePaddle', (x) => {
        const gameId = Object.keys(socket.rooms).find(room => room !== socket.id);
        if (gameId && games[gameId]) {
            io.to(gameId).emit('updateGame', {
                opponentPaddleX: x,
                ball: games[gameId].ball,
                scores: games[gameId].scores
            });
        }
    });

    socket.on('scoreUpdate', (scores) => {
        const gameId = Object.keys(socket.rooms).find(room => room !== socket.id);
        if (gameId && games[gameId]) {
            games[gameId].scores = scores;
            io.to(gameId).emit('updateGame', { ball: games[gameId].ball, scores });
        }
    });

    socket.on('disconnect', () => {
        const gameId = Object.keys(socket.rooms).find(room => room !== socket.id);
        if (gameId && games[gameId]) {
            games[gameId].players = games[gameId].players.filter(id => id !== socket.id);
            if (games[gameId].players.length === 0) delete games[gameId];
            else io.to(gameId).emit('playerDisconnected');
        }
    });
});

function updateGame(gameId) {
    if (games[gameId] && games[gameId].players.length === 2) {
        const game = games[gameId];
        game.ball.x += game.ball.dx;
        game.ball.y += game.ball.dy;
        if (game.ball.x < 0 || game.ball.x > 600) game.ball.dx = -game.ball.dx;
        if (game.ball.y < 0 || game.ball.y > 400) game.ball.dy = -game.ball.dy;
        io.to(gameId).emit('updateGame', { ball: game.ball, scores: game.scores });
        setTimeout(() => updateGame(gameId), 1000 / 60);
    }
}

server.listen(process.env.PORT || 3000);