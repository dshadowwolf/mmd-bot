const levels = [ "user", "Staff", "Moderator", "Admin" ];

function validateUser(user, server, config,logger) {
    let moderatorRole = server.roles.find("name", config.ModeratorRole); 
    let adminRole = server.roles.find("name", config.AdminRole);
    let staffRole = server.roles.find("name", config.StaffRole);
    
    if( moderatorRole == null || adminRole == null || staffRole == null) {
	logger.error(`System not properly configured - role ${config.ModeratorRole}, ${config.AdminRole} or ${config.StaffRole} does not exist`);
	return 0;
    }

    if( user.roles.has(adminRole.id) ) {
	return 3;
    } else if( user.roles.has(moderatorRole.id) ) {
	return 2;
    } else if( user.roles.has(staffRole.id) ) {
	return 1;
    } else {
	return 0;
    }
}

function doValid(user, server, config, logger) {
    let level = validateUser(user,server,config,logger);
    logger.debug( `User ${user} validated as a user of level ${levels[level]}` );
    return level;
}

module.exports = { validate: doValid };

