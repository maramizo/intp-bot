require('dotenv').config();
const Discord = require('discord.js');
const Bot = require('./classes/botClass.js');
const client = new Discord.Client();
var INTPBot;

client.on('ready', () => {
    INTPBot = new Bot(client, Discord);
});

client.on('message', msg => {
    if(msg.content.startsWith('i!') == true)
        INTPBot.handleCommands(msg);
});

client.login(process.env.BOT_TOKEN);