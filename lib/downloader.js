/**
 * Intro:
 * Date:2019-09-20
 *
 * "Life is like riding a bicycle. To keep your balance, you must keep moving." - Albert Einstein
 *
 *                      。
 *      。               ~!,
 *     ~*                ~*@:
 *    !=-                ~:#@
 *   .@;~                  @#
 *    #&  ...~;=&&&&&&&=!~,
 *      ,:%%&!:~~~~~::;!*&%%@#,
 *     .@@~                  !@
 *     &@#                .~&&
 *     #@#-.          &%%@&=!   #@@~     =@#;
 *     .=@@@#&&*!!!;;:~.        @@@.     ,@
 *        -:;!!*=&%%@@@@@*     ~@@;
 *                    ,:@@#    &@@&@&* :&#@#. %%       .!%%*.
 *        -%%-          @@&   .@@!&@@!  *@@-  @@@@@@@ ,@@  @@
 *        ,&@=       ~*&#:    -@& @@=   &@*  .@@~ @@* :@@&@@@：
 *          .;=%%#&*:,..      =@  @@.   @@   ;@=  @@  ~@         *:#。
 *                            @. .@=    @-   &@   @.   @@@@@      .:*#@@@@@&*;-
 *                           ,#  #@:                                          &#~
 *                               @@:                                           *#~
 *                               *@;                              .!          *#~
 *                                @#                           .-&#@@@@@@@%%&~
 *                                 !~                        ~;!&%%.
 *
 */

const request = require('request');
const fs = require('fs');
const URL = require('url');
const md5 = require('md5');
const { exec } = require('child_process');
const path = require('path');
const m3u8Parser = require('m3u8-parser');
const utils = require('./utils');

let maxPN = 15;
let processNum = 0;
let tsCount = 0;
let tsList = [];
let tsOutPuts = [];
let downloadedNum = 0;
let url = '';
let dir = '';
let filmName = 'result';
let key = '';
let IV = 0x00000000000000000000000000000000;
let method = 'AES-128';
let _cb = false;

function renew() {
    maxPN = 15;
    processNum = 0;
    tsCount = 0;
    tsList = [];
    tsOutPuts = [];
    downloadedNum = 0;
    url = '';
    dir = '';
    filmName = 'result';
    key = '';
    method = 'AES-128';
    IV = 0x00000000000000000000000000000000;
    _cb = false;
}

function download(opts, cb) {
    renew();
    if (cb) {
        _cb = cb;
    }
    maxPN = opts.processNum || maxPN;
    url = opts.url;
    if (opts.filmName) {
        filmName = opts.filmName;
        dir = path.join(opts.filePath, filmName);
    } else {
        dir = path.join(opts.filePath, md5(url));
    }

    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir);
    }
    request(url, (err, res, body) => {
        if (err) {
            utils.logError(`problem with request: ${err.message}`);
            return;
        }
        parseM3U8(body);
    });
}

function parseM3U8(content) {
    utils.log('starting parsing m3u8 file');
    const parser = new m3u8Parser.Parser();
    parser.push(content);
    parser.end();
    const parsedManifest = parser.manifest;
    tsList = parsedManifest.segments;
    if (!tsList) {
        utils.logError('m3u8 file error');
        utils.log(content);
        return;
    }
    tsCount = tsList.length;
    if (tsCount > 0) {
        processNum = tsCount > maxPN ? maxPN : tsCount;
    }
    tsOutPuts = [];
    const urlObj = URL.parse(url);
    const host = `${urlObj.protocol}//${urlObj.host}`;
    const urlPath = url.substr(0, url.lastIndexOf('/') + 1);

    if (tsList[0].hasOwnProperty('key') && tsList[0].key.hasOwnProperty('uri')) {
        if (tsList[0].key.hasOwnProperty('method')) {
            method = tsList[0].key.method.toUpperCase();
        }

        if (tsList[0].key.hasOwnProperty('iv')) {
            IV = tsList[0].key.iv;
            if (method === 'AES-128') {
                IV = parseInt(tsList[0].key.iv, 16);
            }
        }
        
        if (tsList[0].key.uri.indexOf('http') < 0) {
            if (tsList[0].key.uri.indexOf('/') === 0) {
                key = host + tsList[0].key.uri;
            } else {
                key = urlPath + tsList[0].key.uri;
            }
        } else {
            key = tsList[0].key.uri;
        }
    }

    for (let i = 0; i < tsCount; i++) {
        if (tsList[i].uri.indexOf('http') < 0) {
            if (tsList[i].uri.indexOf('/') === 0) {
                tsList[i].uri = host + tsList[i].uri;
            } else {
                tsList[i].uri = urlPath + tsList[i].uri;
            }
        }

        const tsOut = `${dir}/${i}.ts`;
        tsList[i] = {
            index: i,
            url: tsList[i].uri,
            file: tsOut
        };
        if (key !== '') {
            tsOutPuts.push(`${tsOut}x`);
        } else {
            tsOutPuts.push(`${tsOut}`);
        }
    }
    if (key !== '') {
        const opt = {
            method: 'GET',
            url: key,
            timeout: 100000,
            headers: {
                'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
            },
            encoding: null
        };
        request(opt, (error2, response2, key2) => {
            key = key2.toString('hex');
            batchDownload();
        });
    } else {
        key = 'nokey';
        batchDownload();
    }
}

function batchDownload() {
    for (let i = 0; i < processNum; i++) {
        downloadTs(i);
    }
}

function downloadTs(index) {
    if (index >= tsCount) {
        return;
    }
    const tsObj = tsList[index];
    const opt = {
        method: 'GET',
        url: tsObj.url,
        timeout: 100000,
        headers: {
            'User-Agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
        },
        encoding: null
    };
    request(opt, (error, response, buff) => {
        if (error) {
            utils.logError(`download failed ts${tsObj.index}error:${error.message}`);
            downloadTs(index);
        } else if (response.statusCode === 200) {
            fs.writeFile(tsObj.file, buff, (error2) => {
                if (error2) {
                    utils.logError(`download failed ts${tsObj.index} error:${error2.message}`);
                    downloadTs(index);
                } else if (key === 'nokey') {
                    downloadedNum++;
                    utils.log(`download ts${tsObj.index} sucess,downloaded ${downloadedNum}/remain${tsCount - downloadedNum}`);
                    checkIfDone();
                    downloadTs(index + processNum);
                } else if (method === 'AES-128') {
                    const cmd = ` openssl aes-128-cbc -d -in "${tsObj.file}" -out "${tsObj.file}x" -nosalt -iv ${IV}  -K ${key}`;
                    exec(cmd, (_error) => {
                        if (_error) {
                            utils.logError(`openssl ts ${index} error: ${_error.message}`);
                        }
                        downloadedNum++;
                        utils.log(`download ts${tsObj.index} sucess,downloaded ${downloadedNum}/remain${tsCount - downloadedNum}`);
                        utils.log(`openssl ts ${index} success`);
                        checkIfDone();
                        downloadTs(index + processNum);
                    });
                }
            });
        }
    });
}

function checkIfDone() {
    if (downloadedNum === tsCount) {
        convertTS();
    }
}

let mp4Num = 0;
let mp4DoneNum = 0;
let toConcat = [];

function convertTS() {
    mp4Num = 0;
    mp4DoneNum = 0;
    toConcat = [];

    toConcat = utils.arrayChunk(tsOutPuts, 100);
    utils.log('concat ts to mp4');
    mp4Num = toConcat.length;
    doConvert(0);
}

function doConvert(index) {
    if (mp4Num === mp4DoneNum) {
        concatMP4();
    } else {
        const outPutMP4 = `${dir}/output${index}.mp4`;
        const strConcat = toConcat[index].join('|');
        if (strConcat !== '') {
            if (fs.existsSync(outPutMP4)) {
                fs.unlinkSync(outPutMP4);
            }
            const cmd = `ffmpeg -i "concat:${strConcat}" -acodec copy -vcodec copy -absf aac_adtstoasc ${outPutMP4}`;
            exec(cmd, (error) => {
                if (error) {
                    utils.logError(`ffmpeg mp4 ${index} error: ${error.message}`);
                    doConvert(index);
                }
                utils.log(`ffmpeg mp4 ${index} success`);
                mp4DoneNum++;
                doConvert(index + 1);
            });
        }
    }
}

function concatMP4() {
    const lastMP4 = `${dir}/${filmName}.mp4`;
    if (mp4Num > 1) {
        let filelist = '';
        for (let i = 0; i < mp4Num; i++) {
            filelist += `file output${i}.mp4 \n`;
        }
        const filePath = path.join(dir, 'filelist.txt');
        fs.writeFileSync(filePath, filelist);
        const cmd = `ffmpeg -f concat -i ${filePath} -c copy ${lastMP4}`;
        exec(cmd, (error) => {
            if (error) {
                utils.logError(`ffmpeg mp4ALL error: ${error.message}`);
                utils.exit();
            }
            utils.log('ffmpeg mp4ALL success');
            deleteTS();
        });
    } else {
        fs.rename(path.join(dir, 'output0.mp4'), lastMP4, (err) => {
            if (err) {
                utils.logError(`rename last mp4 error: ${err.message}`);
                utils.exit();
            }
            deleteTS();
        });
    }
}

function deleteTS() {
    const cmd = `rm -rf ${dir}/*.ts ${dir}/*.tsx ${dir}/output*.mp4 ${dir}/filelist.txt`;
    exec(cmd, (error) => {
        if (error) {
            utils.logError(`delete ts error: ${error.message}`);
            utils.exit();
        }
        utils.log('@@@success@@@');
        if (_cb) {
            _cb();
        }
    });
}


module.exports = {
    download: download
};
