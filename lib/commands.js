const mongo = require('mongodb').MongoClient,
      ObjectID = require('mongodb').ObjectID,
      config = require('../configuration.js');


function toUserRefs( key, value ) {
    if( key == "user" || key == "issuer" ) {
	return "<@"+value+">";
    }
    return value;
}

function rawListCommand( log, url, client, message, args ) {
    var search = {};
    var dataRes = [];
    
    if( args != null && args != "" ) {
	var rres = /<@(!?\d+)>/.exec(args);
	if( rres != null && rres[1] != null ) {
	    search.user = rres[1];
	}
    }

    mongo.connect(url, function(err, db) {
	if( err != null ) {
	    message.channel.send( "Unable to connect to database, see log for error" )
		.then(log.mark("Sent message"))
		.catch(log.fatal);
	    log.fatal("Unable to connect to database: {}", err);
	    Process.exit(-1);
	}
	
	log.info("Connected to the database!");
	
	var collection = db.collection(config.CollectionName);
	
	collection.find(search).toArray(function(error, docs) {
	    log.debug("found "+docs.length+" items");
	    if( error != null ) {
		log.fatal("Error finding data: "+error);
		message.channel.send( "Error querying data store, dying!" )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		Process.exit(-3);
	    }

	    for( i = 0; i < docs.length; i++ ) {
		const curDoc = docs[i];
		if( curDoc.active || curDoc.active == null ) {
		    log.debug( JSON.stringify(curDoc, toUserRefs, '\t') );
		    message.channel.send( JSON.stringify(curDoc, toUserRefs, '\t') )
			.then(log.mark("Sent message"))
			.catch(log.fatal);;
		}
	    }
	});

	db.close();
    });
    
}

function listCommand( log, url, client, message, args ) {
    var search = null;
    var dataRes = [];
    
    if( args != null && args != "" ) {
	var rres = /<@(!?\d+)>/.exec(args);
	if( rres != null && rres[1] != null ) {
	    search = { user: rres[1]};
	}
    }

    mongo.connect(url, function(err, db) {
	if( err != null ) {
	    message.channel.send( "Unable to connect to database, see log for error" )
		.then(log.mark("Sent message"))
		.catch(log.fatal);
	    log.fatal("Unable to connect to database: {}", err);
	    Process.exit(-1);
	}
	log.info("Connected to the database!");
	
	var collection = db.collection(config.CollectionName);
	
	collection.find(search).toArray(function(error, docs) {
	    log.debug("found "+docs.length+" items");
	    if( error != null ) {
		log.fatal("Error finding data: "+error);
		message.channel.send( "Error querying data store, dying!" )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		Process.exit(-3);
	    }

	    var count = 0;
	    for( i = 0; i < docs.length; i++ ) {
		const curDoc = docs[i];
		if( curDoc.active || curDoc.active == null ) {
		    if( search != {} ) {
			count += curDoc.demerit;
		    }
		    var msg = "User <@"+curDoc.user+"> broke rule "+curDoc.rule+" on "+curDoc.date+" for "+curDoc.demerit+" point(s)\n"+
			"<@"+curDoc.issuer+"> issued the infraction of type "+curDoc.type+", with proof "+curDoc.proof;
		    if( curDoc.extra != "" ) {
			msg += " and the added message of: "+curDoc.extra;
		    }
		    message.channel.send( msg )
			.then(log.mark("Sent message"))
			.catch(log.fatal);
		    
		    log.debug(msg);
		}
	    }
	    
	    if( count > 0 && search != null ) {
		message.channel.send( `User <@${search.user}> has an infraction point total of ${count}` )
				      .then(log.mark("Sent message"))
				      .catch(log.fatal);
                log.debug(`User <@${search.user}> has an infraction point total of ${count}`);
	    }
	});

	db.close();
    });
    
}

function removeCommand( log, url, client, message, args ) {
    log.info("entering removeCommand");
    if( args != null && args.length != "" ) {
	// there should only ever be *ONE* argument, but we can do this sanely...
	var entryId = new ObjectID((/^([a-fA-F\d]+).*/.exec(args))[1].trim());
	log.info(`entryId = ${entryId}`);
	
	mongo.connect(url, function(err, db) {
	    if( err != null ) {
		message.channel.send( "Unable to connect to database, see log for error" )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		log.fatal("Unable to connect to database: {}", err);
		Process.exit(-1);
	    }
	    log.info("Connected to the database!");
	    

	    var collection = db.collection(config.CollectionName);
				     
	    collection.findOneAndUpdate( {_id:entryId}, {$set:{active:false}}, {returnOriginal:false} )
		.then( function( res ) {
		    message.channel.send( `Infraction with id ${entryId} flagged as invalid/can be deleted` )
			.then(log.mark("Sent message"))
			.catch(log.fatal);
		})
		.catch( function(error) {
		    if( error != null ) {
			message.channel.send( "Unable to update specified record, see logs" )
			    .then(log.mark("Sent message"))
			    .catch(log.fatal);
			log.error( `Unable to update record id ${entryId}: ${error}` );
			Process.exit(-4);
		    }
		}); 
	    db.close();
	});
    }
}

function expungeCommand( log, url, client, message, args ) {
    log.info("entering expungeCommand");
    const adminRole = message.guild.roles.find("name", config.AdminRole);
    if( !message.member.roles.has(adminRole.id) ) { return; }
    if( args != null && args.length != "" ) {
	// there should only ever be *ONE* argument, but we can do this sanely...
	var entryId = new ObjectID((/^([a-fA-F\d]+).*/.exec(args))[1].trim());
	log.info(`entryId = ${entryId}`);
	
	mongo.connect(url, function(err, db) {
	    if( err != null ) {
		message.channel.send( "Unable to connect to database, see log for error" )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		log.fatal("Unable to connect to database: {}", err);
		Process.exit(-1);
	    }
	    log.info("Connected to the database!");
	    

	    var collection = db.collection(config.CollectionName);
				     
	    collection.findOneAndDelete( {_id:entryId}, {$set:{active:false}}, {returnOriginal:false} )
		.then( function( res ) {
		    message.channel.send( `Infraction with id ${entryId} flagged as invalid/can be expunged from the record` )
			.then(log.mark("Sent message"))
			.catch(log.fatal);
		})
		.catch( function(error) {
		    if( error != null ) {
			message.channel.send( "Unable to remove specified record, see logs" )
			    .then(log.mark("Sent message"))
			    .catch(log.fatal);
			log.error( `Unable to update record id ${entryId}: ${error}` );
			Process.exit(-4);
		    }
		}); 
	    db.close();
	});
    }
}

function user_info( log, url, client, message, args ) {
    let user = message.member;
    let userid = user.id;

    user.createDM().then( function(res) {
	mongo.connect(url, function(err,db) {
	    if( err != null ) {
		message.channel.send( "Unable to connect to database, see log for error" )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		log.fatal("Unable to connect to database: {}", err);
		Process.exit(-1);
	    }
	    log.info("Connected to the database!");
	    
	    var collection = db.collection(config.CollectionName);
	    
	    collection.find({ user: ""+userid, active: true }).toArray(function(error, docs) {
		log.debug("found "+docs.length+" items");
		if( error != null ) {
		    log.fatal("Error finding data: "+error);
		    message.channel.send( "Error querying data store, dying!" )
			.then(log.mark("Sent message"))
			.catch(log.fatal);
		    Process.exit(-3);
		}

		if( docs.length > 0 ) {
		    var count = 0;
		    for( i = 0; i < docs.length; i++ ) {
			const curDoc = docs[i];
			var msg = `Infraction ${i+1}: broke rule ${curDoc.rule} on ${curDoc.date} for ${curDoc.demerit} point(s)`;
			res.send( msg )
			    .then(log.mark("Sent message"))
			    .catch(log.fatal);
			
			log.debug(msg);
		    }
		    
		    if( count > 0 ) {
			res.send( `You have an infraction point total of ${count}` )
			    .then(log.mark("Sent message"))
			    .catch(log.fatal);
			log.debug(`User <@${search.user}> has an infraction point total of ${count}`);
		    }
		} else {
		    res.send( `You have no currently valid infractions` );
		}
	    });
	    
	    db.close();
	});
    });
    user.deleteDM().then(log.mark(`DM with <@${userid}> (@${user.user.username}#${user.user.tag}) deleted`)).catch(log.fatal);
}

function addCommand( log, url, client, message, args ) {
    // first parameter is perpetratrator
    // next is the count
    // then the type
    try {
	var splitter = /^<@(!?\d+)>\s+(\d+)\s+(.*)/.exec(args);
	var perp = splitter[1];
	var count = Number.parseInt(splitter[2]);
	var rest = splitter[3].split(/\s+/);
	var userID = message.member.id;
    } catch( e ) {
	log.error( `Error extracting arguments: ${e} from args ${args} for client ${client} and message ${message}` );
	message.channel.send( `Error in command with args ${args}` );
	return;
    }
    // at this point we know the user-id and the number of points
    // in the "rest" we have a set of partially noted parameters
    // this is a touch trickier to manage
    var infract = { type: "",
	            user: perp,
		    demerit: count,
		    rule: "",
		    proof: "",
		    date: new Date(Date.now()),
		    issuer: userID,
		    active: true,
		    extra: "" };

    const params = [ "type", "rule", "proof", "extra" ];
    const isPart = /^([^:]+):(.*)$/;
    var curName = 'type';
    for( i = 0; i < rest.length; i++ ) {
	if( isPart.test(rest[i]) ) {
	    var bits = isPart.exec(rest[i]);
	    if( params.includes( bits[1] ) ) {
		curName = bits[1];
		if( bits.length > 2 ) {
		    if( infract[curName] != "" ) {
			infract[curName] += " "+ bits[2];
		    } else {
			infract[curName] = bits[2];
		    }
		}
	    }
	} else if( rest[i+1] == ":" && params.includes(rest[i])) {
	    curName = rest[i];
	    infract[curName] = rest[i+2];
	} else if( rest[i] == ":" || rest[i-1] == ":" ) {
	    // just here to keep the parser sane
	} else {
	    if( infract[curName] != "" ) {
		infract[curName] += " "+rest[i];
	    } else {
		infract[curName] = rest[i];
	    }
	}
    }

    let jsms = JSON.stringify(infract, null, '\t');
    message.channel.send( `Add Command - args: ${args}`+"\nSetting: ```json\n"+`${jsms}`+"\n```" );

    mongo.connect(url, function(err, db) {
	if( err != null ) {
	    message.channel.send( "Unable to connect to database, see log for error" )
		.then(log.mark("Sent message"))
		.catch(log.fatal);
	    log.fatal("Unable to connect to database: {}", err);
	    Process.exit(-1);
	}
	log.info("Connected to the database!");
	
	var collection = db.collection(config.CollectionName);
	collection.insert( infract, function( err, res ) {
	    if( err != null ) {
		log.fatal("Error adding infraction to database: "+err);
		message.channel.send( `<@${message.member.id}> error handling your command - could not insert record of infraction into storage.` )
		    .then(log.mark("Sent message"))
		    .catch(log.fatal);
		
		Process.exit(-2);
	    }

	    var rMessage = "Command Result:";
	    
	    if( res.result.n != 1 && res.ops.length != 1 ) {
		log.error("Results do not match the attempted insert but no error reported");
		rMessage = rMessage.concat(" result does not match specifics of insert, but no error was reported:");
	    }
	    
	    rMessage = rMessage.concat(" "+res.result.n+" infraction(s) added");
	    log.info( rMessage );
	    message.channel.send( rMessage )
		.then(log.mark("Sent message"))
		.catch(log.fatal);
	    db.close();
	});
    });
}

module.exports = { add: addCommand,
		   list: listCommand,
		   rawlist: rawListCommand,
		   remove: removeCommand,
		   expunge: expungeCommand,
		   userInfo: user_info };
