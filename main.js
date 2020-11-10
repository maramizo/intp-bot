require('dotenv').config();
const Discord = require('discord.js');
const Bot = require('./classes/botClass.js');
const client = new Discord.Client();
var INTPBot;

client.on('ready', () => {
    INTPBot = new Bot(client, Discord);
});

client.on('message', msg => {
    var lowerCase = msg.content.toLowerCase();
    if(msg.author.bot == false){
        if(lowerCase.startsWith('i!') == true)
            INTPBot.handleCommands(msg);
        else
            INTPBot.handleMessages(msg);
    }
});

client.login(process.env.BOT_TOKEN);