require('dotenv').config();
const ProgressBar = require('progress');
const { Writable } = require('stream');
const Queue = require('./Queue');

const ws = Writable({ objectMode: true });
// const { knex } = require('../database/knex');

async function migrate() {

    const recordCount = 1000;

    const bar = new ProgressBar('Migrating [:bar] :percent :etas :current/:total (:rate)', {
      width: 40,
      total: recordCount,
    });

    const iterms = new Array(recordCount).fill(1);


    async function deal(data){
      await new Promise((resolve, reject) => {
        setTimeout(() => {
          //console.log(data);
          resolve();
        }, 1000);
      });
    }

    const queue = Queue(200);
    for(const item of iterms){
      await queue.add(async ()=> {
        await deal(item);
      }, () => {
        bar.tick();
      })
    }


    // inter
    // await new Promise((resolve, reject) => {
    //   setTimeout(() => {
    //     resolve();
    //   }, 100000);
    // });

    // intervally check the bar
     const interval = setInterval(() => {
       if (bar.complete) {
            clearInterval(interval);
       }
     }, 1000);

}

migrate();
