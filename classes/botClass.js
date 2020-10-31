const connectionHandler = require('./connectionHandler.js');
const DBHandler = new connectionHandler();
const path = require('path');
const https = require('https');
var rootCas = require('ssl-root-cas').create();
rootCas.inject();
rootCas.addFile(path.resolve(__dirname, '../cert/intermediate.pem'));
https.globalAgent.options.ca = rootCas;
const chartMaker = require('./chartMaker.js');
const imgur = require('imgur');

class Bot{
    
    constructor(client, Discord){
        this.userMessages = [];
        this.client = client;
        this.mentionRegEx = /<@(.*?)>/g;
        console.log("Bot class created successfully.");
        console.log(`Logged in as ${this.client.user.tag}!`);
        this.Discord = Discord;
        this.usersWaiting = [];
    }
    
    
    //ehmessage -> Edit Humane Message.
    //          -> Edits a message after a set amount of time.
    //          -> Displays typing icon before & removes it after.
    ehmessage(message, string, time = 2000){
        message.channel.startTyping();
        setTimeout(function(){
            message.edit(string);
            message.channel.stopTyping();
        }, time);
    }    
    
    shmessage(channel, string, time = 2000){
        channel.startTyping();
        setTimeout(function(){
            channel.send(string);
            channel.stopTyping();
        }, time);
    }    
    
    
    async handleCommands(message){
        var command = message.content.substr(2).toLowerCase();
        if(command.startsWith("type")){
            if(this.usersWaiting[message.author.id] != null || this.usersWaiting[message.author.id] != undefined){
                message.channel.send("I'm going as fast as I can...");
                return;
            }
            this.usersWaiting[message.author.id] = true;
            message.channel.startTyping();
            message.channel.send("Finding existing messages from " + message.author.tag + "...").then(async (bot_message) => {
                
                var lastMessage = await DBHandler.findMessage(message.author.id);
                message.channel.stopTyping();
                
                //Check if user has messages.                
                if(lastMessage != null && lastMessage != undefined){
                
                    //TRUE -> Grab all messages by user on DB.
                    //     -> Get oldest message_id per channel_id for user.
                    //     -> Get older + newer messages until new 1K is hit using message_id & channel_id.
                    //     -> Store older + newer messages.
                    //     -> Clean messages and send array of strings to backend.
                    
                    this.ehmessage(bot_message, "Existing messages found; collecting more data to increase accuracy. This might take a bit..");
                    var oldMessages = await DBHandler.getAllMessages(message.author.id);
                    //console.dir('__________________________________Existing Messages:');
                    //console.dir(oldMessages);
                    
                    var existingMessages = await DBHandler.getFirstMessagesPerChannel(message.author.id);
                    var rMessages = await this.userGuildMessages(bot_message.guild.id, message.author.id, existingMessages);
                    var newMessages = this.cleanArray(rMessages);
                    
                    if(newMessages == undefined || newMessages.length < 1000){
                        var olderMessages = await this.userGuildMessages(bot_message.guild.id, message.author.id, existingMessages, true);
                        olderMessages = this.cleanArray(olderMessages);
                        newMessages.push.apply(newMessages, olderMessages);
                    }
                    var totalMessages = [];
                    totalMessages.push.apply(totalMessages, oldMessages);
                    totalMessages.push.apply(totalMessages, newMessages);
                    console.dir('Total Messages: ' + totalMessages.length + '. New: ' + newMessages.length + '. Old messages: ' + oldMessages.length);
                    //console.dir('___________________________New Messages:');
                    //console.dir(newMessages);

                    if(newMessages.length > 0)
                        var res = await this.storeData(newMessages, bot_message);

                    this.typeUser(totalMessages, bot_message, message.author);
                    
                }else{
                    // FALSE -> Grab 1K messages of user.
                    //       -> Store messages.
                    //       -> Send messages to backend.
                    //       -> Receive link to image.
                    //       -> Display result.
                    
                    this.ehmessage(bot_message, "No existing messages found; collecting data. This might take a bit..");
                    var collectedMessages = await this.userGuildMessages(bot_message.guild.id, message.author.id);
                    var messages = this.cleanArray(collectedMessages);
                    
                    if(messages.length < 1){
                        this.ehmessage(bot_message, "No messages found on this server by you. Are you sure you've typed in enough messages?");
                        return;
                    }
                    
                    this.storeData(messages, bot_message);
                    this.typeUser(messages, bot_message, message.author);
                }            
            });
        }
        else if(command.startsWith("deldata")){
            DBHandler.deleteAllUserData(message.author.id).then(r => {
                if(r > 0)
                    message.channel.send(r + " existing messages have been deleted succesfully.");
                else
                    message.channel.send("You have no existing messages stored.");
            });
        }
        /*else if(command.startsWith("l")){
            this.debugMessage(message);
        }*/
    }
    
    async storeData(messages, bot_message){
        this.ehmessage(bot_message, "Storing data into database...");
        var res = await DBHandler.insert(messages);
        return res;
    }
    
    async typeUser(messages, botmessage, user){
        
        this.ehmessage(botmessage, "Predicting personality type (receiving relevant information)..");        
        var post_messages = [];
        if(messages != undefined && messages.length > 0){
            messages.forEach(m => {
                post_messages.push(this.cleanMessage(m.message));
            });
        }
        
        var post_data = JSON.stringify({sentence: post_messages, key: process.env.POST_KEY});
        console.log(post_data);
        
        var options = {
            hostname: 'is-conic.com',
            path: '/api/v1/b5_processor',
            method: 'POST',
        }
            
        
        console.log("Sending request to API.");
            
        const req = https.request(options, res => {
            console.log(`statusCode: ${res.statusCode}`);        

            res.on('data', async(d) => {                
                var predictions = JSON.parse(d).predictions;
                var chart = new chartMaker(predictions, user.username);
                
                var imageB64 = await chart.renderChart();
                imgur.uploadBase64(imageB64).then(json => {
                    var imageLink = json.data.link;
                    console.log(imageLink);
                    
                    const predictionEmbed = new this.Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(user.username + "'s Big 5 Personality Score")
                    .setDescription('Based on ' + post_messages.length + ' messages.')
                    .setURL(imageLink)
                    .setAuthor('INTP Bot')
                    .addFields(
                        { name: 'Openness', value: predictions.OPN.toFixed(2), inline: true},
                        { name: 'Conscientiousness', value: predictions.CON.toFixed(2), inline: true},
                        { name: 'Extraversion', value: predictions.EXT.toFixed(2), inline: true},
                        { name: 'Agreeableness', value: predictions.AGR.toFixed(2), inline: true},
                        { name: 'Neuroticism', value: predictions.NEU.toFixed(2), inline: true})
                    .setImage(imageLink)
                    .setTimestamp()
                    .setFooter('© Conic, Sergen, Moe & jcl132.');

                    botmessage.channel.send(predictionEmbed);
                    botmessage.delete();
                    
                    this.usersWaiting[user.id] = null;
                    
                }).catch(function(err){
                    console.error(err);
                });
                /*
                this.shmessage(botmessage.channel, "Your results are in! You have scored:" + '\n'
                              + "Openness: " + dimensions.OPN + '\n'
                              + "Conscientiousness: " + dimensions.CON + '\n'
                              + "Extraversion: " + dimensions.EXT + '\n' 
                              + "Agreeableness: " + dimensions.AGR + '\n' 
                              + "Neuroticism: " + dimensions.NEU);*/
            });
        });

        req.on('error', error => {
            console.error(error);
            botmessage.edit("Error communicating with backend server. Please try again later");
            botmessage.channel.stopTyping();
                  
            this.usersWaiting[user.id] = null;
        });

        req.write(post_data);
        //Get result from PY.
        //Edit message to reflect results. 
        
        req.end();
    }
    
    cleanMessage(message){
        return message.replace(/\\/g, "\\\\")
               .replace(/\$/g, "\\$")
               .replace(/'/g, "\\'")
               .replace(/"/g, "\\\"");
    }
    
    async userGuildMessages(guildID, userID, existingMessages = null, before = false){
        var message_array = [];
        var ar_length = this.countMembers(this.client.guilds.cache.get(guildID).channels.cache);
        var index = 0;
        
        if(existingMessages != null){
            var channelMessageIndex = {};
            existingMessages.forEach(eMessage => {
                channelMessageIndex[eMessage._id] = eMessage;
            });
        }
        
        return Promise.all(this.client.guilds.cache.get(guildID).channels.cache.map(async (ch) => {
            if (ch.type === 'text'){
                if(existingMessages != null){
                    var returned_message = await this.getMessages(ch, userID, 1000, channelMessageIndex[ch.id], before);
                    returned_message.forEach(m => {
                        message_array.push(m);
                    });        
                }else{
                    var returned_message = await this.getMessages(ch, userID, 1000);
                    returned_message.forEach(m => {
                        message_array.push(m);
                    });
                }
            }
            index++;
            if(index == ar_length){
                return message_array;
            }
        }));
    }
    
    async getMessages(channel, userID, limit = 1000, eMessage = null, before = true){
        let out = []
        let rounds = (limit / 100) + (limit % 100 ? 1 : 0);
        var last_id = "";
        
        const options = {
            limit: 100,
        }
        
        if(eMessage != null && before == true)
            last_id = eMessage.firstMessage;
        else if(eMessage != null && before == false)
            last_id = eMessage.lastMessage;
            
        for (let x = 0; x < rounds; x++) {
            if (last_id.length > 0) {
                if(before == true)
                    options.before = last_id;
                else
                    options.after = last_id;
            }                

        
            //console.dir('Finding messages ' + ((before == true)? 'before' : 'after') + ' message ID ' + last_id + ' on round: ' + x + ' in channel: ' + channel.id);
            //console.dir(options);
            let messages = await channel.messages.fetch(options);   
            if(before == false)
                messages = this.reverseArr(messages);
            messages.forEach(m => {
                var content = m.content.replace(this.mentionRegEx, "");
                if(this.filterBotCommands(content) == true && m.author.id === userID){ //Remove bot commands & messages with less than two words.
                    var qCheck = false;
                    if(before == true && m.id < options.before)
                        qCheck = true;
                    else if(before == false && m.id > options.after)
                        qCheck = true;
                    //console.dir('added m_id: ' + m.id + ', before: ' + before + ', original_id: ' + last_id + ', qCheck: ' + qCheck + ', round: ' + x + 'channel_id: ' + channel.id);
                    out.push({user_id: m.author.id, message: content, message_id: m.id, channel_id: m.channel.id, timestamp: m.createdTimestamp});
                }
                last_id = m.id;
            });
            //console.dir('round: ' + x + ', last_id: ' + last_id + ' channel_id: ' + channel.id);
        }
        //console.dir('loop done');
        return out;
    }
    
    async debugMessage(message, limit=1000){
        const options = {
            limit: limit,
            after: message.content.substr(4)
        }
        
        //console.dir(options);
        
        let messages = await message.channel.messages.fetch(options);
        messages.forEach(x => {
            console.dir(x.content);
        });
    }
    
    reverseArr(input) {
        var ret = new Array;
        for(var i = input.length-1; i >= 0; i--) {
            ret.push(input[i]);
        }
        return ret;
    }
    
    /*handleCommands(message){
        var command = message.content.substr(2).toLowerCase();
        if(command.startsWith("type")){
            message.channel.startTyping();
            message.channel.send("Finding existing messages from " + message.author.tag + "...").then(async (bot_message) => {
                var lastMessage = await DBHandler.findLastMessage(message.author.id); //Check DB for messages from user ID.
                if(lastMessage == null || lastMessage == undefined){ //User has no existing lastMessage stored.
                    setTimeout(function(){bot_message.edit("No existing messages found; collecting data. This might take a bit..")}, 2000);
                    this.userGuildMessages(bot_message.guild.id, message.author.id).then(x => {
                        var messages = this.cleanArray(x);
                        this.typeUser(messages, message.author, bot_message);
                    });
                }else{
                    setTimeout(function(){bot_message.edit("Existing messages found; collecting more data to increase accuracy. This might take a bit..")}, 2000);
                    console.dir(lastMessage.message_id); //Get last message ID.
                    var messages = await this.userGuildMessages(bot_message.guild.id, message.author.id, null, lastMessage.message_id);//Get messages after last message ID.
                    messages = this.cleanArray(messages);                    
                    //Get user messages until last ID in DB is hit if any.
                    //If last ID is hit before 1K limit is hit, get messages before earliest find in DB.                    
                    if(messages.length < 1000){
                        var firstMessage = await DBHandler.findLastMessage(message.author.id, 1); //Get user's first message.
                        var older_messages = await this.userGuildMessages(bot_message.guild.id, message.author.id, lastMessage.message_id);
                        older_messages = this.cleanMessages(this.cleanArray(older_messages));
                        messages.push(older_messages);
                        messages = messages[0];
                    }
        
                    var old_messages = await DBHandler.getAllMessages(message.author.id);
                    console.dir(old_messages);
                    old_messages = this.cleanMessages(old_messages);
                    old_messages.forEach(m => {
                        messages.push(m.message);
                    });
                    
                    console.dir(messages);
                    
                    this.typeUser(messages, message.author, bot_message);
                }
            });
        }else if(command.startsWith("deldata")){
            DBHandler.deleteAllUserData(message.author.id).then(r => {
                if(r > 0)
                    message.channel.send(r + " existing messages have been deleted succesfully.");
                else
                    message.channel.send("You have no existing messages stored.");
            });
        }
    }*/
    
    cleanArray(array){
        return array.filter(element => {
           return (element != undefined && element != null);  
        })[0];
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
    
    cleanMessages(message_array){
        var new_array = [];
        message_array.forEach(m => {
            new_array.push(m.message.replace(/\\/g, "\\\\")
                            .replace(/\$/g, "\\$")
                            .replace(/'/g, "\\'")
                            .replace(/"/g, "\\\""));
        });
        return new_array;
    }    
    
    runPythonScript(){
        
    }
}
module.exports = Bot;