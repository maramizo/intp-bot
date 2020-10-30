require('dotenv').config();
const MongoClient = require('mongodb').MongoClient;
const test = require('assert');
const URL = process.env.DB_URI;

class connectionHandler{
    constructor(){
        MongoClient.connect(URL, function(err, client) {
            if(err)
                throw err;
            else{
                console.log("Connected succesfully.");
                client.close();
            }
        });
    }
    
    async findLastMessage(userid, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err);});
        
        if(!client)
            return;
        
        try{
            var dbo = client.db(database);
            let res = await dbo.collection(collection).find({ user_id: userid }).sort({message_id: -1}).limit(1).toArray();
            res = res[0];
            return res;
        } catch(err) {
            throw err;
        } finally {
            client.close();
        }
    }
    
    insert(data, database = process.env.DB_NAME, collection = process.env.CL_NAME){
         MongoClient.connect(URL, function(err, client) {
            if(err)
                throw err;
            else{              
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
    
    async deleteAllUserData(userid){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err);});
        
        if(!client)
            return;
        
        try{
            var dbo = client.db(process.env.DB_NAME);
            let res = await dbo.collection(process.env.CL_NAME).deleteMany({ user_id: userid });
            return res.result.n;
        } catch(err) {
            throw err;
        } finally {
            client.close();
        }        
    }
}
module.exports = connectionHandler;