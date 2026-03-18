import https from 'https';
import fs from 'fs';

const url = 'https://res.cloudinary.com/dqzzgydyl/image/upload/v1773808143/minidrive-uploads/xm1muwjcrthzluiynokj.pdf';

https.get(url, (res) => {
    const info = {
        statusCode: res.statusCode,
        headers: res.headers
    };
    fs.writeFileSync('cld_headers.json', JSON.stringify(info, null, 2));
    process.exit(0);
});
