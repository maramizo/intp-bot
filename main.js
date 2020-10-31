require('dotenv').config();
const Discord = require('discord.js');
const Bot = require('./classes/botClass.js');
const Chart = require('./classes/chartMaker.js');
const client = new Discord.Client();
var INTPBot;
var chart = new Chart();

client.on('ready', () => {
    INTPBot = new Bot(client, Discord);
    chart.renderChart();
});

client.on('message', msg => {
    if(msg.content.startsWith('i!') == true)
        INTPBot.handleCommands(msg);
});

client.login(process.env.BOT_TOKEN);