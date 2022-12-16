function Queue(size){

    let queue = size;

    return {
      add: async function(task, callback){
        while(queue <= 0){
          await new Promise((resolve, reject) => {
            setTimeout(() => {
              resolve();
            }, 20);
          });
        }
        if(queue > 0) {
          queue--;
          task().then(() => {
            callback();
            queue++;
          });
        } else {
          throw "failed because of missing task";
        }
      }
    }
}

module.exports = Queue;
