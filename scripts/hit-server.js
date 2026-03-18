import http from 'http';

const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY5Yjk5ZGFmMGE3NjY0NzU4NGZiYjA3MiIsImlhdCI6MTc3Mzc3MjIwNywiZXhwIjoxNzc2MzY0MjA3fQ.bLlReowI0eMLrlTUBBrqC923oNjlI5q3sPViWqilO-s';
const fileId = '69ba2a108f4581bdb6c6fa44';
const url = `http://localhost:5000/api/files/v/${fileId}?token=${token}`;

console.log('Hitting URL:', url);

http.get(url, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('TYPE:', res.headers['content-type']);
    process.exit(0);
}).on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
