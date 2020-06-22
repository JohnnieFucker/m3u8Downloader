# m3u8 Downloader



use node.js download m3u8 to mp4 by multi process

need ffmpeg

### how to use

const downloader = require('m3u8_multi_downloader');

downloader.download({
    url: 'https://yun.kubozy-youku-163.com/20190709/16666_5a9c65b6/1000k/hls/index.m3u8',
    processNum: 15,
    filePath: 'video',
    filmName: '测试视频'
});
