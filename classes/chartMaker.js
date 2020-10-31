const GoogleChartsNode = require('google-charts-node');
const fs = require('fs');
var b64 = require('../exports/base64.js');

class Chart{
    constructor(scores, name){
    this.drawChartStr = `
      // Create the data table.
      var data = new google.visualization.DataTable();
      data.addColumn('string', 'Category');
      data.addColumn('number', 'Points');
      data.addRows([
        ['Openness', ${scores.OPN.toFixed(2)}],
        ['Conscientiousness', ${scores.CON.toFixed(2)}],
        ['Extraversion', ${scores.EXT.toFixed(2)}],
        ['Agreeableness', ${scores.AGR.toFixed(2)}],
        ['Neuroticism', ${scores.NEU.toFixed(2)}],
      ]);
      // Set chart options
      var options = { title: "${name}'s Big 5 Personality Traits Score" };
      // Instantiate and draw our chart, passing in some options.
      var chart = new google.visualization.ColumnChart(document.getElementById('chart_div'));
      chart.draw(data, options);
    `;        
    }
    
    async renderChart(){
        // Render the chart to image
        const image = await GoogleChartsNode.render(this.drawChartStr, {
          width: 1024,
          height: 1024,
        });
        return b64.bytesToBase64(image);
    }
}
module.exports = Chart;