const connectionHandler = require('./connectionHandler.js');
const DBHandler = new connectionHandler();
class Bot{
    
    constructor(client){
        this.userMessages = [];
        this.client = client;
        this.mentionRegEx = /<@(.*?)>/g;
        console.log("Bot class created successfully.");
        console.log(`Logged in as ${this.client.user.tag}!`);
    }
    
    
    handleCommands(message){
        var command = message.content.substr(2).toLowerCase();
        if(command.startsWith("type")){
            message.channel.startTyping();
            message.channel.send("Finding existing messages from " + message.author.tag + "...").then(async (bot_message) => {
                var lastMessage = DBHandler.findLastMessage(message.author.id); //Check DB for messages from user ID.
                if(lastMessage == null || lastMessage == undefined){
                    setTimeout(function(){bot_message.edit("No existing messages found; collecting data. This might take a bit..")}, 2000);
                    this.userGuildMessages(bot_message.guild.id, message.author.id).then(x => {
                        var messages = this.cleanArray(x);
                        this.typeUser(messages, message.author, bot_message);
                    });
                }else{
                    //Get last message ID.
                    //Get messages after last message ID.
                    //this.typeUser(..?, ..?);
                }
            });
            //Get user messages until last ID in DB is hit if any.
            //If last ID is hit before 1K limit is hit, get messages before earliest find in DB.
        }
    }
    
    typeUser(messages, user, botmessage){
        DBHandler.insert(messages); //Store them into DB.
        botmessage.edit("Storing data into database...");
        //Call PY script.
        //Get result from PY.
        //Edit message to reflect results.        
    }
    
    cleanArray(array){
        return array.filter(element => {
           return (element != undefined && element != null);  
        })[0];
    }
    
    async getMessages(channel, userID, limit = 100){
        let out = []
        if (limit <= 100) {
            let messages = await channel.messages.fetch({ limit: limit })
            messages = messages.filter(m => m.author.id === userID);
            messages.forEach(m => {
                var content = m.content.replace(this.mentionRegEx, "");
                if(this.filterBotCommands(content) == true){ //Remove bot commands & messages with less than two words.
                    out.push({user_id: m.author.id, message: content, timestamp: m.createdTimestamp});
                }                
            })
        } else {
            let rounds = (limit / 100) + (limit % 100 ? 1 : 0)
            let last_id = ""
            for (let x = 0; x < rounds; x++) {
                const options = {
                    limit: 100
                }
                if (last_id.length > 0) {
                    options.before = last_id
                }
                
                let messages = await channel.messages.fetch(options);
                messages.forEach(m => {
                    var content = m.content.replace(this.mentionRegEx, "");
                    if(this.filterBotCommands(content) == true && m.author.id === userID){ //Remove bot commands & messages with less than two words.
                        out.push({user_id: m.author.id, message: content, timestamp: m.createdTimestamp});
                    }
                    last_id = m.id;
                });
            }
        }
        //console.dir(out);
        return out;
    }
    
    async userGuildMessages(guildID, userID){
        var message_array = [];
        var ar_length = this.countMembers(this.client.guilds.cache.get(guildID).channels.cache);
        var index = 0;
        return Promise.all(this.client.guilds.cache.get(guildID).channels.cache.map(async (ch) => {
            if (ch.type === 'text'){
                var returned_message = await this.getMessages(ch, userID, 1000);
                returned_message.forEach(m => {
                    message_array.push(m);
                });
            }
            index++;
            if(index == ar_length){
                return message_array;
            }
        }));
    }
    
    
    countMembers(object){
        var count = 0;
        
        object.forEach(i => {
            count++;    
        })
        
        return count;
    }
    
    
    filterBotCommands(message){
        
        if(message == undefined || message == null)
            return false;
        
        var words = message.split(" "); // If message has less than 3 words
        if(words.length < 3)
            return false;
        
        if(message.match(/^[$!\-]|^[>]+|.!/) != null) // If message starts with $, ! or -
            return false;
        
        return true;
    }
    
    runPythonScript(){
        
    }
}
module.exports = Bot;