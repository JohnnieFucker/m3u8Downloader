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
const utils = require('./utils');

let maxPN = 15;

let processNum = 0;
let tsCount = 0;
let tsList = [];
let tsOutPuts = [];
let downloadedNum = 0;
let url = '';
let dir = '';


function download(opts) {
    maxPN = maxPN || opts.processNum;
    url = opts.url;
    dir = path.join(opts.filePath, md5(url));

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
    tsList = content.match(/((http|https):\/\/.*)|(.+\.ts)/g);
    tsCount = tsList.length;
    if (tsCount > 0) {
        processNum = tsCount > maxPN ? maxPN : tsCount;
    }
    tsOutPuts = [];
    const urlObj = URL.parse(url);
    const host = `${urlObj.protocol}//${urlObj.host}`;
    const urlPath = url.substr(0, url.lastIndexOf('/') + 1);

    for (let i = 0; i < tsCount; i++) {
        if (tsList[i].indexOf('http') < 0) {
            if (tsList[i].indexOf('/') === 0) {
                tsList[i] = host + tsList[i];
            } else {
                tsList[i] = urlPath + tsList[i];
            }
        }
        const tsOut = `${dir}/${i}.ts`;
        tsList[i] = {
            index: i,
            url: tsList[i],
            file: tsOut
        };
        tsOutPuts.push(tsOut);
    }
    batchDownload();
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
    utils.log(`start download ts${tsObj.index}`);
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
                } else {
                    downloadedNum++;
                    utils.log(`download ts${tsObj.index} sucess,downloaded ${downloadedNum}/remain${tsCount - downloadedNum}`);
                    checkIfDone();
                    downloadTs(index + processNum);
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
    const lastMP4 = `${dir}/result.mp4`;
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
    const cmd = `rm -rf ${dir}/*.ts ${dir}/output*.mp4`;
    exec(cmd, (error) => {
        if (error) {
            utils.logError(`delete ts error: ${error.message}`);
            utils.exit();
        }
        utils.log('@@@success@@@');
    });
}


module.exports = {
    download: download
};
