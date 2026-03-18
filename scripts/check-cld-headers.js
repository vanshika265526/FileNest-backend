import https from 'https';

const url = 'https://res.cloudinary.com/dqzzgydyl/image/upload/v1773808143/minidrive-uploads/xm1muwjcrthzluiynokj.pdf';

console.log('Fetching Cloudinary URL:', url);

https.get(url, (res) => {
    console.log('STATUS:', res.statusCode);
    console.log('HEADERS:', JSON.stringify(res.headers, null, 2));
    process.exit(0);
}).on('error', (err) => {
    console.error('Error:', err.message);
    process.exit(1);
});
