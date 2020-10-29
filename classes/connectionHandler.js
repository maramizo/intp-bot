require('dotenv').config();
const MongoClient = require('mongodb').MongoClient;
const test = require('assert');
const URL = process.env.DB_URI;

class connectionHandler{
    constructor(){
        MongoClient.connect(URL, function(err, client) {
            // Use the admin database for the operation
            if(err)
                throw err;
            else{
                const adminDb = client.db(process.env.DB_NAME).admin();
                console.log("Connected succesfully.");
            }
        });
    }
    
    findLastMessage(userid, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        MongoClient.connect(URL, function(err, client){
            if(err) throw err;
            var dbo = client.db(database);
            dbo.collection(collection).find({ user_id: userid }).sort({message_id: -1}).limit(1).toArray(function(err, res){
                if(err) throw err;
                client.close();
                return res;
            });
        });
    }
    
    insert(data, database = process.env.DB_NAME, collection = process.env.CL_NAME){
         MongoClient.connect(URL, function(err, client) {
            if(err)
                throw err;
            else{
                const adminDb = client.db(process.env.DB_NAME).admin();
                
                var dbo = client.db(database);
                if(Array.isArray(data) == false){
                    dbo.collection(collection).insertOne(data, function(err, res){
                        if(err)
                            throw err;
                        else{
                            console.log("One row inserted.");
                            client.close;
                        }
                    });
                }else{
                    dbo.collection(collection).insertMany(data, function(err, res){
                        if(err)
                            throw err;
                        else{
                            console.log("Number of rows inserted: " + res.insertedCount);
                            client.close;
                        }
                    });                    
                }
            }
        });
    }
    
    select(){}
    
    update(){}
    
    delete(){}
}
module.exports = connectionHandler;