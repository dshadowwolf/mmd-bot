const Discord = require('discord.js'),
      fs = require('fs'),
      log = require('log4js'),
      commandFuncs = require('./lib/commands.js'),
      perms = require('./lib/permissions.js'),
      config = require('./configuration.js');

log.configure( {
    appenders: { full:    { type: 'file', filename: 'logs/mmdbot-everything.log', level: 'all' },
		 error:   { type: 'file', filename: 'logs/mmdbot-errors.log', level: 'error' },
	         console: { type: 'stderr', level: 'warn' } },
    categories: { default: { appenders: [ 'full', 'error', 'console' ], level: 'all' } } });

const logger = log.getLogger();
    
const client = new Discord.Client();

client.login(config.BotSecret);

client.on('debug', (...args) => {
    console.log(process.uptime().toFixed(3), ...args);
    logger.debug( `${args}` );
});

client.on('ready', function() {
    logger.info(`bot ${client.user.username}#${client.user.tag} ready`);
    console.log(`bot ${client.user.username}#${client.user.tag} ready`);
});

const connection_url = config.Connection;

const command_regex = /^!(\S+)\s*(.*)?$/;

const commands = { "add"       : { function: commandFuncs.add,
				   short_help: "!add @name count type: <type if infraction> rule: <which rule was broken> proof: <url of screenshot/other proof> extra: <other data>\n"+
				   "add an infraction of type \"type\" and value \"count\" to user \"@name\" for breaking rule \"rule\", etc...",
				   help: "Adds an infraction for the noted user, of 'count' points\n"+
				   "The issuer and date are set automatically from who issues the command and the date&time it is issued\n"+
				   "The type of infraction follows the 'type:' keyword\n"+
				   "The actual rule broken follows the 'rule' keyword\n"+
				   "Proof of the violation follows the 'proof' keyword and extra data may be added using the 'extra' keyword.\n"+
				   "All keywords are followed by a colon (:) that separates them from their data",
				   level: 2 },
		   "list"      : { function: commandFuncs.list,
				   short_help: "!list [@name] - list all infractions or just those for @name",
				   help: "!list [@name]\n"+
				   "If optional parameter \"@name\" is given, list all current, active infractions for the given user and their total point count\n"+
				   "Otherwise list all infractions in the database",
				   level: 1 },
		   "rawlist"   : { function: commandFuncs.rawlist,
				   short_help: "!rawlist [@name] - return raw infraction data of all infractions or just for @name",
				   help: "!rawlist [@name]\n"+
				   "If optional parameter \"@name\" is given, list all current, active infractions for the given user in a raw format and their total point count\n"+
				   "Otherwise list all infractions in the database in a raw data format",
				   level: 2 },
		   "remove"    : { function: commandFuncs.remove,
				   short_help: "!remove <infraction id> - mark an infraction as not being valid anymore",
				   help: "!remove <infraction id>\n"+
				   "Marks an infraction as not being valid and should not be counted against a users point-total - this exists for accountaing reasons.\n"+
				   "Admins (MMDA) can use !expunge to fully remove an entry",
				   level: 2 },
		   "expunge"   : { function: commandFuncs.expunge,
				   short_help: "!expunge <infraction id> - completely remove an infraction from the system",
				   help: "___**MMD ADMIN ONLY!!**___\n!expunge <infraction id>\n"+
				   "Completely removes the targeted infraction from the database",
				   level: 3 },
		   "help"      : { function: doHelp,
				   short_help: "!help [command] - without an argument this gives a quick overview of each command, with an argument it will give in-depth help on each command",
				   help: "!help [command]\n"+
				   "Given a command as an argument, you get a long-form help text about the command (like the one you're reading right now)\n"+
				   "Without the argument you'll get a short-form overview of all the commands - usually a single line of text",
				   level: 0 },
		   "myinfo"    : { function: commandFuncs.userInfo,
				   short_help: "!myinfo - list any infractions placed on your account",
				   help: "!myinfo\n" +
				   "Get a listing of all infractions placed on your account and a total count of how many infraction points you have earned. This information is sent to you as a DM",
				   level: 0 } };

function validateUser(user, server) {
    return perms.validate(user,server,config,logger);
}

function doHelp( log, con_url, cl, message, args ) {
    let uLev = validateUser(message.member, message.guild);
    if( args == undefined ) {
	for( f in commands ) {
	    if( commands[f].level <= uLev ) {
		message.channel.send( `${commands[f].short_help}` );
	    }
	}
    } else {
	if( commands.hasOwnProperty(args) && commands[args].level <= uLev ) {
	    message.channel.send( `${commands[args].help}` );
	} else {
	    message.channel.send( `Unknown command ${args}` );
	}
    }	
}

client.on('message', function(msg) {
    if( command_regex.test(msg.content) && msg.author.id != client.user.id && msg.guild != null) {
	const channel = msg.channel;
	var result = command_regex.exec(msg);
	var command = result[1];
	var args = result[2];
	logger.fatal(`Possible command ${command} with args \"${args}\"`);
	// channel ID does not matter - user must validate as either Moderator or MMD Admin
	if( commands.hasOwnProperty(command) ) {
	    let tc = commands[command];
	    if( msg.guild != null ) {
		if( validateUser( msg.member, msg.guild ) >= tc.level ) {
		    commands[command].function(logger, connection_url, client, msg, args);
		} else {
		    logger.warn( `User @${msg.author.id} (@${msg.author.username}#${msg.author.tag}) tried to use command ${command} with insufficient permissions` );
		}
	    } else {
		if( commands[command].level == 0 ) {
		    commands[command].function(logger, connection_url, client, msg, args);
		} else {
		    logger.warn( `User @${msg.user.id} (@${msg.user.user.username}#${msg.user.user.tag}) tried to use command ${command} in a DM` );
		}
	    }
	}
    }
});

