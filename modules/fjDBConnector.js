module.exports = new function(options){
  this.init = function(req, res, step, callback) {
    callback(req, res, ++step);
  }
}
