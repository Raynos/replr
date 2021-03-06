repl = require('repl')
net = require('net')
merge = require('merge')
cluster = require('cluster')
colors = require('colors')
terminal = require('terminal')
async = require('async')
EventEmitter = require('events').EventEmitter
MemoryStream = require('memorystream')
portscanner = require('portscanner')
ReplrClient = require('./ReplrClient')
ReplrEvents = require('./ReplrEvents')
Util = require('./Util')

class ReplrServer extends EventEmitter

  @::OPTIONS_DEFAULT = 
    name: 'Replr'
    port: 2323
    prompt: 'replr> '.grey
    terminal: false
    useColors: false
    describeWorker: null

  @::OPTIONS_REPL_KEYS = ['port', 'prompt', 'terminal', 'useColors']

  constructor: (options, start=true)->
    if options 
      if options.port
        if typeof options.port == 'number'
          throw new Error('bad port') if !Util::isInt(options.port) || options.port < 1
        else if typeof options.port != 'string'
          throw new Error('bad port')
      if options.prompt
        throw new Error('bad prompt') if typeof options.prompt != 'string'
      #todo: validate other options

    @options = merge @OPTIONS_DEFAULT, options
    @clients = []
    @started = false
    @starting = false
    return if start then @start() else @


  start: (callback)->
    return if @starting
    @starting = true

    onVerified = (err, status)=>
      if err || status == 'open'
        callback(err || new Error('Port already taken')) if callback
        return
    
      @socketServer = net.createServer @open.bind(@)
      @socketServer.on 'listening', ()=>
        @started = true
        @starting = false
        @emit 'listening'

      try
        @socketServer.listen @options.port
      catch err
        @started = false
        @starting = false
        callback err if callback

    if typeof @options.port == 'number'
      portscanner.checkPortStatus @options.port, '127.0.0.1', onVerified
    else 
      onVerified null, 'free'


  close: (callback)->
    if @starting
      @once 'listening', ()=>
        @close callback
    else if @started
      @socketServer.close ()=>
        @started = false
        @emit 'close'
        callback() if callback
    else
      callback(new Error('Already closed'))


  open: (socket)->
    # Start session with options
    replOptions = {}
    for key in @OPTIONS_REPL_KEYS
      replOptions[key] = @options[key] if @options.hasOwnProperty key
    replOptions.input = socket
    replOptions.output = socket

    r = repl.start replOptions

    # Ensure we close the socket if repl is closed
    r.on 'exit', ()=>
      socket.end()

    # Track client and remove when disconnect occurs
    client = new ReplrClient(@, @options, socket, r)
    @clients.push client
    socket.on 'error', (err)=>
      if err && err.code == 'EPIPE'
        return

      throw err
    socket.on 'end', ()=>
      @clients.splice @clients.indexOf(client), 1

    # Setup context variables from default exports and options
    r.context.exported = {}
    for key, value of client.exports()
      r.context.exported[key] = value
      r.context[key] = value

    if @options.exports && typeof @options.exports == 'function'
      exports = @options.exports(client)
      if exports && Object.keys(exports).length > 0 
        for key, value of exports
          r.context.exported[key] = value
          r.context[key] = value

    # Welcome client
    client.welcome()


  forwardToWorker: (client, worker)->
    msg = 
      type: ReplrEvents::WORKER_RECEIVE
      options: @options

    # Keep the REPL alive but attached to dummy so we 
    # only remove the client after connection closes
    dummy = new MemoryStream()
    client.repl.inputStream = dummy
    client.repl.outputStream = dummy
    client.repl.rli.input = dummy
    client.repl.rli.output = dummy

    worker.send msg, client.socket


  describeWorkers: (callback)->
    formatTitle = (id, worker)-> "[#{id}] id=#{id}, pid=#{worker.process.pid}\n"

    if typeof @options.describeWorker == 'function'
      workersArray = (worker for id, worker of cluster.workers)

      async.map workersArray, (worker, cb)=>
        @options.describeWorker worker, (description)=>
          str = "#{formatTitle(worker.id, worker)}#{terminal.lpad(description, 1)}"
          cb null, str
      , (err, results)=>
        callback results.join("\n")

    else 
      callback (formatTitle(id, worker) for id, worker of cluster.workers).join("\n")


module.exports = ReplrServer
