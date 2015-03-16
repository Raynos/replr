// Generated by CoffeeScript 1.6.3
(function() {
  var ReplrClient, chalk, cluster, doc, terminal, util;

  cluster = require('cluster');

  chalk = require('chalk');

  doc = require('doc');

  terminal = require('terminal');

  util = require('util');

  ReplrClient = (function() {
    var key, value, _ref;

    ReplrClient.prototype.TERM_CODES = {
      clear: '\u001B[2J',
      zeroPos: '\u001B[0;0f'
    };

    ReplrClient.prototype.TERM_CODES_VALUES = [];

    _ref = ReplrClient.prototype.TERM_CODES;
    for (key in _ref) {
      value = _ref[key];
      ReplrClient.prototype.TERM_CODES_VALUES.push(value);
    }

    function ReplrClient(server, options, socket, repl) {
      this.server = server;
      this.options = options;
      this.socket = socket;
      this.repl = repl;
      this.interceptTabsForCompletions();
    }

    ReplrClient.prototype.write = function(msg, callback) {
      var err, _i, _len, _ref1;
      if (callback == null) {
        callback = null;
      }
      if (!this.options.terminal) {
        msg = terminal.stripStyles(msg);
        _ref1 = this.TERM_CODES_VALUES;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          value = _ref1[_i];
          try {
            msg = msg.replace(new RegExp(value, 'g'), '');
          } catch (_error) {
            err = _error;
          }
        }
      }
      if (!this.options.useColors) {
        msg = chalk.stripColor(msg);
      }
      if (callback) {
        return this.socket.write(msg, callback);
      } else {
        return this.socket.write(msg);
      }
    };

    ReplrClient.prototype.send = function(result, callback) {
      if (callback == null) {
        callback = null;
      }
      this.write("\n" + (this.indent(result, 2)) + "\n\n", callback);
    };

    ReplrClient.prototype.indent = function(str, indentBy) {
      var i, spaces, _i;
      spaces = '';
      for (i = _i = 1; 1 <= indentBy ? _i <= indentBy : _i >= indentBy; i = 1 <= indentBy ? ++_i : --_i) {
        spaces += ' ';
      }
      return "" + spaces + (str.replace(/\n/g, "\n" + spaces));
    };

    ReplrClient.prototype.exports = function() {
      var cmds, exports, select, vars, workers, write,
        _this = this;
      cmds = function() {
        ({
          doc: "Prints all available commands in the local REPL context with documentation"
        });
        return _this.send(_this.getCommands());
      };
      vars = function() {
        ({
          doc: "Prints all available variables in the local REPL context and their types"
        });
        return _this.send(_this.getVars());
      };
      workers = function() {
        var prompt;
        ({
          doc: "Prints all workers running on this cluster"
        });
        prompt = _this.repl.prompt;
        _this.repl.prompt = '';
        _this.getWorkersDescription(function(description) {
          _this.send(description);
          _this.write(prompt);
          return _this.repl.prompt = prompt;
        });
      };
      select = function(workerId) {
        ({
          doc: "Changes into the worker context with the given workerId"
        });
        return _this.changeWorker(workerId);
      };
      write = function(obj, options) {
        var text;
        if (options == null) {
          options = {
            colors: true
          };
        }
        ({
          doc: "Writes text or util.inspect(obj, text) to this REPL session, useful for other exported methods"
        });
        text = typeof obj === 'string' ? obj : util.inspect(obj, options);
        _this.send(text);
      };
      exports = {
        help: 'Type .help for repl help, use cmds() to get commands in current context',
        exit: 'Did you mean .exit?',
        repl: this.repl,
        replOptions: this.options,
        cmds: cmds,
        vars: vars,
        write: write
      };
      if (cluster.isMaster) {
        exports.workers = workers;
        exports.select = select;
      }
      return exports;
    };

    ReplrClient.prototype.changeWorker = function(workerId) {
      var worker, _ref1;
      _ref1 = cluster.workers;
      for (key in _ref1) {
        worker = _ref1[key];
        if (worker.id === workerId) {
          this.server.forwardToWorker(this, worker);
          return;
        }
      }
      return this.send("Could not find worker with worker ID '" + workerId + "'");
    };

    ReplrClient.prototype.getCommands = function() {
      var commands, described, descriptions, exported, func, indentBy, longest, signature, signatureAsString, _i, _j, _len, _len1, _ref1;
      exported = {};
      _ref1 = this.repl.context.exported;
      for (key in _ref1) {
        value = _ref1[key];
        exported[key] = typeof value.unbound === 'function' ? value.unbound : value;
      }
      commands = (function() {
        var _i, _len, _ref2, _results;
        _ref2 = Object.keys(exported);
        _results = [];
        for (_i = 0, _len = _ref2.length; _i < _len; _i++) {
          key = _ref2[_i];
          if (typeof exported[key] === 'function') {
            _results.push(key);
          }
        }
        return _results;
      })();
      signatureAsString = function(name, func) {
        return "" + key + "(" + (doc.docArgsAsArray(func).join(', ')) + ")";
      };
      longest = 0;
      for (_i = 0, _len = commands.length; _i < _len; _i++) {
        key = commands[_i];
        signature = signatureAsString(key, exported[key]);
        if (signature.length > longest) {
          longest = signature.length;
        }
      }
      indentBy = longest + 6;
      descriptions = [];
      for (_j = 0, _len1 = commands.length; _j < _len1; _j++) {
        key = commands[_j];
        func = exported[key];
        signature = terminal.rpad(signatureAsString(key, func), indentBy);
        described = '';
        terminal.printWrapped(doc.docAsString(func), 80, indentBy, function(out) {
          return described += out + "\n";
        });
        descriptions.push("" + signature + (described.substring(indentBy)));
      }
      if (descriptions.length > 0) {
        descriptions.unshift('');
        descriptions.unshift("" + (terminal.rpad('--', indentBy)) + "--");
        descriptions.unshift("" + (terminal.rpad('function', indentBy)) + "documentation");
        descriptions.unshift('');
        descriptions.unshift(chalk.cyan("(" + commands.length + ") commands in the local REPL context"));
      } else {
        descriptions = [chalk.cyan("There are no commands in the local REPL context")];
      }
      return descriptions.join("\n");
    };

    ReplrClient.prototype.getVars = function() {
      var descriptions, exported, formattedKey, indentBy, longest, vars, _i, _j, _len, _len1;
      exported = this.repl.context.exported;
      vars = (function() {
        var _i, _len, _ref1, _results;
        _ref1 = Object.keys(exported);
        _results = [];
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          key = _ref1[_i];
          if (typeof exported[key] !== 'function') {
            _results.push(key);
          }
        }
        return _results;
      })();
      longest = 0;
      for (_i = 0, _len = vars.length; _i < _len; _i++) {
        key = vars[_i];
        if (key.length > longest) {
          longest = key.length;
        }
      }
      indentBy = longest + 6;
      descriptions = [];
      for (_j = 0, _len1 = vars.length; _j < _len1; _j++) {
        key = vars[_j];
        value = exported[key];
        formattedKey = terminal.rpad(key, indentBy);
        descriptions.push("" + formattedKey + (typeof value));
      }
      if (descriptions.length > 0) {
        descriptions.unshift('');
        descriptions.unshift("" + (terminal.rpad('--', indentBy)) + "--");
        descriptions.unshift("" + (terminal.rpad('name', indentBy)) + "info");
        descriptions.unshift('');
        descriptions.unshift(chalk.cyan("(" + vars.length + ") variables in the local REPL context"));
      } else {
        descriptions = [chalk.cyan("There are no variables in the local REPL context")];
      }
      return descriptions.join("\n");
    };

    ReplrClient.prototype.getWorkersDescription = function(callback) {
      var _this = this;
      return this.server.describeWorkers(function(description) {
        var active, nonEssentialLineBreak, plural;
        active = Object.keys(cluster.workers).length;
        plural = active !== 1 ? 's' : '';
        nonEssentialLineBreak = active > 0 ? "\n" : '';
        return callback("" + (chalk.cyan("(" + active + ") worker active" + plural + nonEssentialLineBreak)) + "\n" + description);
      });
    };

    ReplrClient.prototype.welcome = function() {
      var _this = this;
      return this.getWelcomeMessage(function(message) {
        return _this.write([_this.TERM_CODES.clear, _this.TERM_CODES.zeroPos, message].join(''));
      });
    };

    ReplrClient.prototype.getWelcomeMessage = function(callback) {
      var hint, title,
        _this = this;
      title = chalk.cyan.bold('Welcome');
      hint = 'Hint: use cmds() to print the current exports available to you';
      if (cluster.isMaster) {
        return this.getWorkersDescription(function(description) {
          return callback("" + title + " " + _this.options.name + "[Master]\n\n" + (_this.indent(description, 2)) + "\n\n" + hint + "\n\n" + _this.repl.prompt);
        });
      } else {
        return callback("" + title + " to " + this.options.name + "[Worker]\n\n" + hint + "\n\n" + this.repl.prompt);
      }
    };

    ReplrClient.prototype.getTabCompletions = function(input, callback) {
      var _this = this;
      return this.repl.complete(this.inputBuffer, function(err, results) {
        var completion, completions, text, _i, _len;
        if (!err) {
          completions = results[0];
          text = '';
          for (_i = 0, _len = completions.length; _i < _len; _i++) {
            completion = completions[_i];
            text += completion + '\n\n';
          }
          return callback(text, completions);
        } else {
          return callback('', []);
        }
      });
    };

    ReplrClient.prototype.interceptTabsForCompletions = function() {
      var _this = this;
      this.inputBuffer = '';
      this.socketRead = this.socket.read;
      return this.socket.read = function() {
        var exc, input, result;
        result = _this.socketRead.apply(_this.socket, arguments);
        input = '';
        try {
          input = result.toString('utf8');
        } catch (_error) {
          exc = _error;
        }
        if (input === '\t') {
          _this.getTabCompletions(_this.inputBuffer, function(text, completions) {
            var remaining;
            if (completions.length === 1) {
              remaining = completions[0].substr(_this.inputBuffer.length);
              _this.socket.emit('data', remaining);
              return _this.socket.write(remaining);
            } else {
              return _this.write("" + text + _this.repl.prompt + _this.inputBuffer);
            }
          });
          return null;
        } else if (input === '\n' || input === '\r') {
          _this.inputBuffer = '';
        } else if (input) {
          _this.inputBuffer += input;
        }
        return result;
      };
    };

    return ReplrClient;

  })();

  module.exports = ReplrClient;

}).call(this);