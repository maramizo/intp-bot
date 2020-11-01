const GoogleChartsNode = require('google-charts-node');
var b64 = require('../exports/base64.js');

class Chart{
    constructor(scores, axis, name){
        this.drawChartStr = `
          // Create the data table.
          var data = new google.visualization.DataTable();
          data.addColumn('string', 'Category');
          data.addColumn('number', 'Points');
          data.addRows([
            ['${axis[0]}', ${scores[0].toFixed(2)}],
            ['${axis[1]}', ${scores[1].toFixed(2)}],
            ['${axis[2]}', ${scores[2].toFixed(2)}],
            ['${axis[3]}', ${scores[3].toFixed(2)}],
            ['${axis[4]}', ${scores[4].toFixed(2)}],
          ]);
          // Set chart options
          var options = { title: "${name}'s Big 5 Personality Traits Score", vAxis: {minValue: 0, maxValue: 100 } };
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