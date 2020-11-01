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
const fs = require('fs');
const request = require('request');

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
                    
                    var totalMessages = await this.collectMoreData(message, bot_message);
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
                    
                    if(messages == undefined || messages.length < 1){
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
        }else if(command.startsWith("ibmtype")){
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
                    var oldMessages = await DBHandler.getAllMessages(message.author.id);
                    
                    this.ehmessage(bot_message, "Existing messages found; collecting more data to increase accuracy. This might take a bit..");
                    var totalMessages = await this.collectMoreData(message, bot_message);
                    
                    this.ehmessage(bot_message, "Sending data to IBM.");
                    this.IBMType(totalMessages, bot_message, message.author);
                }else{
                    this.ehmessage(bot_message, "No existing messages found; collecting data. This might take a bit..");
                    var collectedMessages = await this.userGuildMessages(bot_message.guild.id, message.author.id);
                    var messages = this.cleanArray(collectedMessages);
                    
                    if(messages == undefined || messages.length < 1){
                        this.ehmessage(bot_message, "No messages found on this server by you. Are you sure you've typed in enough messages?");
                        return;
                    }
                    
                    this.storeData(messages, bot_message);
                    this.IBMType(messages, bot_message, message.author);                    
                }
                
            });
            
        }else if(command.startsWith("itf")){
            if(this.usersWaiting[message.author.id] != null || this.usersWaiting[message.author.id] != undefined){
                message.channel.send("I'm going as fast as I can...");
                return;
            }
            this.usersWaiting[message.author.id] = true;
            message.channel.startTyping();
            message.channel.send("Finding existing messages from " + message.author.tag + "...").then(async (bot_message) => {
                var lastMessage = await DBHandler.findMessage(message.author.id);
                if(lastMessage == null || lastMessage == undefined){
                    this.ehmessage(bot_message, "You cannot use this command unless if you already have stored your messages on this server. Please use i!ibmtype.");
                    this.usersWaiting[message.author.id] = null;
                    return;
                }
                var oldMessages = await DBHandler.getAllMessages(message.author.id);
                this.ehmessage(bot_message, "Sending existing data to IBM.");
                this.IBMType(oldMessages, bot_message, message.author);                
                
            });
            
        }
    }
    
    async collectMoreData(message, bot_message){
        var oldMessages = await DBHandler.getAllMessages(message.author.id);

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
      
        if(newMessages.length > 0)
            var res = await this.storeData(newMessages, bot_message);
        
        return totalMessages;
    }
    
    formatRequestMessages(messages){
        var formattedMessages = [];
        messages.forEach(m => {
            formattedMessages.push(m.message);
        });
        return formattedMessages.join(" ");
    }
    
    createEmbed(user, description, image, fields){
        this.description = description;
        
        const predictionEmbed = new this.Discord.MessageEmbed()
        .setColor('#0099ff')
        .setTitle(user.username + "'s Big 5 Personality Score")
        .setDescription(description)
        .setURL(image)
        .setAuthor('INTP Bot')
        .addFields(fields)
        .setImage(image)
        .setTimestamp()
        .setFooter('© Conic, Sergen, Moe & IBM.');
        
        return predictionEmbed;
    }
    
    async IBMType(messages, botmessage, user){
        var dataString = this.formatRequestMessages(messages);
        
        var options = {
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
                'Accept': 'application/json'
            },
            url: 'https://api.eu-gb.personality-insights.watson.cloud.ibm.com/instances/2ae0aa28-5b31-44a0-8d79-ef37157b7a9e/v3/profile?version=2017-10-13',
            method: 'POST',
            body: dataString,
            auth: {
                'user':'apikey',
                'pass':'8NcI4rUOjE_4kx1104XL5IMY04qXYNrXg389OxnSY611'
            }
        }
        
        request(options, async (error, res, body) => {
            if(error){
                console.error(error);
                botmessage.edit("Error communicating with backend server. Please try again later");
                botmessage.channel.stopTyping();

                this.usersWaiting[user.id] = null;                
            }else if(res){
                try{
                    console.log('statusCode:', res.statusCode);

                    this.ehmessage(botmessage, "Finalizing data (parsing information).", 100);

                    var info = JSON.parse(body);

                    var imageLinks = [];
                    var personalityFields = [];

                    var mainPersona = [];
                    var mainAxis = [];

                    var newImage, newImageLink;
                    var pItem, child;
                    
                    info.personality.forEach((personalityItem, index) => {
                        if(personalityFields[0] == undefined)
                            personalityFields[0] = [];
                        personalityFields[0][personalityItem.name] = personalityItem.percentile*100;
                        personalityItem.children.forEach((child, cIndex) => {
                            if(personalityFields[index+1] == undefined)
                                personalityFields[index+1] = [];
                            personalityFields[index+1][child.name] = child.percentile*100;
                        });
                    });
                    
                    for(var index in personalityFields){
                        
                        this.ehmessage(botmessage, "Finalizing data (drawing chart #" + (parseInt(index) + 1) + ").", 100);                        
                        var chart = new chartMaker(Object.values(personalityFields[index]), Object.keys(personalityFields[index]), user.username);
                        newImage = await chart.renderChart();

                        this.ehmessage(botmessage, "Finalizing data (uploading chart #" + (parseInt(index) + 1) + ").", 100);                        
                        newImageLink = await imgur.uploadBase64(newImage);
                        newImageLink = newImageLink.data.link;
                        imageLinks.push(newImageLink);
                    }
                    
                    // Image Links & personalityFields: M, C, E, A, N, O ???
                    // console.dir(imageLinks);
                    var orderedPf = [];
                    var index = 0;
                    
                    Object.keys(personalityFields).forEach(pF => {
                        orderedPf[index] = [];
                        Object.keys(personalityFields[pF]).forEach(pfKey => {
                            orderedPf[index].push({name: pfKey, value: personalityFields[pF][pfKey].toFixed(2), inline:true});
                        });
                        index++;
                    });                    
                    
                    var newestMessage = await DBHandler.findMessage(user.id);
                    var oldestMessage = await DBHandler.findMessage(user.id, 1);
                    
                    var newestDateTime = newestMessage.timestamp;
                    var oldestDateTime = oldestMessage.timestamp;
                        
                    var nDT = new Date(newestDateTime).toLocaleDateString("en-US");
                    var oDT = new Date(oldestDateTime).toLocaleDateString("en-US");
                    
                    const predictionEmbed = this.createEmbed(user, 'Based on ' + info.word_count + ' words from ' + nDT + ' to ' + oDT + '.', imageLinks[0], orderedPf[0]);
                    var selected = 0;
                    
                    botmessage.channel.send(predictionEmbed).then(embedMessage => {
                        var oceanReacts = ['⬅️', '🇴', '🇨', '🇪', '🇦', '🇳']
                        const filter = (reaction, userX) => {return userX.id == user.id && (oceanReacts.includes(reaction.emoji.name))};
                        oceanReacts.forEach(r => {embedMessage.react(r)});
                        var collector = embedMessage.createReactionCollector(filter);
                        collector.on('collect', collected => {
                            if(oceanReacts.includes(collected.emoji.name)){
                                oceanReacts.forEach((react, index) => {
                                    if(react == collected.emoji.name){
                                        const editedEmbed = this.createEmbed(user, this.description, imageLinks[index], orderedPf[index]);
                                        embedMessage.edit(editedEmbed);
                                    }
                                });
                            }
                        });
                    });
                    botmessage.delete();
                    this.usersWaiting[user.id] = null;
                    
                }catch(err){
                    console.error(err);
                }
                
                /*var chart = new chartMaker(predictions, axisNames, user.username);
                var imageB64 = await chart.renderChart();
                    
                this.ehmessage(botmessage, "Finalizing data (uploading chart).", 100);
                
                imgur.uploadBase64(imageB64).then(async(json) => {
                    var baseImage = json.data.link;
                    console.dir(baseImage);
                    
                    chart = new ChartMaker(predictions, axisNames, user.username);
                    
                    var newestMessage = await DBHandler.findMessage(user.id);
                    var oldestMessage = await DBHandler.findMessage(user.id, 1);
                    
                    var newestDateTime = newestMessage.timestamp;
                    var oldestDateTime = oldestMessage.timestamp;
                        
                    var nDT = new Date(newestDateTime).toLocaleDateString("en-US");
                    var oDT = new Date(oldestDateTime).toLocaleDateString("en-US");
                    
                    const predictionEmbed = new this.Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(user.username + "'s Big 5 Personality Score")
                    .setDescription('Based on ' + info.word_count + ' words from ' + nDT + ' to ' + oDT + '.')
                    .setURL(baseImage)
                    .setAuthor('INTP Bot')
                    .addFields(
                        { name: 'Openness', value: predictions.OPN.toFixed(2), inline: true},
                        { name: 'Conscientiousness', value: predictions.CON.toFixed(2), inline: true},
                        { name: 'Extraversion', value: predictions.EXT.toFixed(2), inline: true},
                        { name: 'Agreeableness', value: predictions.AGR.toFixed(2), inline: true},
                        { name: 'Neuroticism', value: predictions.NEU.toFixed(2), inline: true})
                    .setImage(baseImage)
                    .setTimestamp()
                    .setFooter('© Conic, Sergen, Moe & IBM.');

                    botmessage.channel.send(predictionEmbed);
                    botmessage.delete();
                    
                    this.usersWaiting[user.id] = null;
                
                });*/
            }
        });
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
        
        var messageCount = post_messages.length;
        
        post_messages = [post_messages.join(" ")];
        
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
                 
            //Get result from PY.
            //Edit message to reflect results. 

            res.on('data', async(d) => {                
                var predictions = JSON.parse(d).predictions;
                var predictionsX = [
                    predictions.OPN,
                    predictions.CON,
                    predictions.EXT,
                    predictions.AGR,
                    predictions.NEU
                ];
                
                var axisX = ['Openness', 'Conscientiousness', 'Extraversion', 'Agreeableness', 'Neuroticism'];                
                var chart = new chartMaker(predictionsX, axisX, user.username);
                
                var imageB64 = await chart.renderChart();
                imgur.uploadBase64(imageB64).then(async(json) => {
                    var imageLink = json.data.link;
                    
                    var newestMessage = await DBHandler.findMessage(user.id);
                    var oldestMessage = await DBHandler.findMessage(user.id, 1);
                    
                    var newestDateTime = newestMessage.timestamp;
                    var oldestDateTime = oldestMessage.timestamp;
                        
                    var nDT = new Date(newestDateTime).toLocaleDateString("en-US");
                    var oDT = new Date(oldestDateTime).toLocaleDateString("en-US");
                    
                    const predictionEmbed = new this.Discord.MessageEmbed()
                    .setColor('#0099ff')
                    .setTitle(user.username + "'s Big 5 Personality Score")
                    .setDescription('Based on ' + messageCount + ' messages from ' + nDT + ' to ' + oDT + '.')
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
            });
        });

        req.on('error', error => {
            console.error(error);
            botmessage.edit("Error communicating with backend server. Please try again later");
            botmessage.channel.stopTyping();
                  
            this.usersWaiting[user.id] = null;
        });

        req.write(post_data);
        
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
            try{
                if (ch.type === 'text'){
                    if(existingMessages != null){
                        var returned_message = await this.getMessages(ch, userID, 10000, channelMessageIndex[ch.id], before);
                        if(returned_message != undefined){
                            returned_message.forEach(m => {
                                message_array.push(m);
                            });
                        }
                    }else{
                        var returned_message = await this.getMessages(ch, userID, 10000);
                        if(returned_message != undefined){
                            returned_message.forEach(m => {
                                message_array.push(m);
                            });
                        }
                    }
                }
                index++;
                if(index == ar_length){
                    return message_array;
                }
            }catch(err){
                console.error(err);
            }
        }));
    }
    
    async getMessages(channel, userID, limit = 10000, eMessage = null, before = true){
        try{
            let out = [];
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

                let messages = await channel.messages.fetch(options);
                if(before == false)
                    messages = this.reverseArr(messages);
                messages.forEach(m => {
                    var content = m.content.replace(this.mentionRegEx, "");
                    if(this.filterBotCommands(content) == true && m.author.id === userID){ //Remove bot commands & messages with less than two words.
                        out.push({user_id: m.author.id, message: content, message_id: m.id, channel_id: m.channel.id, timestamp: m.createdTimestamp});
                    }
                    last_id = m.id;
                });
            }
            return out;
        }catch(error){
            console.error(error);
            console.dir(channel.name);
        }
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