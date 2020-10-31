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
    
    // findMessage finds the newest stored user message by default.
    // sortOrder = 1 finds the oldest.
    async findMessage(userid, sortOrder = -1, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err);});
        
        if(!client)
            return;
        
        try{
            var dbo = client.db(database);
            let res = await dbo.collection(collection).find({ user_id: userid }).sort({message_id: sortOrder}).limit(1).toArray();
            res = res[0];
            return res;
        } catch(err) {
            throw err;
        } finally {
            client.close();
        }        
    }
    
    async insert(data, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err)});
        
        if(!client)
            return;
        
        var dbo = client.db(database);
        try{
            if(Array.isArray(data) == false){
                const res = await dbo.collection(collection).insertOne(data);
                console.log("One row inserted");
                client.close();
                return true;
            }else{
                const res = await dbo.collection(collection).insertMany(data);
                console.log("Number of rows inserted: " + res.insertedCount);
                client.close();
                return true;
            }
        } catch(err) {
            console.log(err);
        } finally {
            client.close();
        }
    }
    
    async getFirstMessagesPerChannel(userid, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err);});
        
        if(!client)
            return;
        
        try{
            var dbo = client.db(database);
            let res = await dbo.collection(collection).aggregate([
                {'$match': {'user_id': userid}}, 
                {'$sort': {'message_id': 1, 'channel_id': 1}}, 
                {'$group': {'_id': '$channel_id', 'firstMessage': {'$first': '$message_id'}, 'lastMessage': {'$last': '$message_id'}}}
            ]).toArray();
            return res;
        }catch(err){
            throw err;
        }finally{
            client.close();
        }
        
    }
    
    async getAllMessages(userid, database = process.env.DB_NAME, collection = process.env.CL_NAME){
        const client = await MongoClient.connect(URL)
            .catch(err => {console.log(err);});
        
        if(!client)
            return;
        
        try{
            var dbo = client.db(database);
            let res = await dbo.collection(collection).find({ user_id: userid }).toArray();
            return res;
        }catch(err){
            throw err;
        }finally{
            client.close();
        }
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
            client.close();
            return res.result.n;
        } catch(err) {
            throw err;
        } finally {
            client.close();
        }
    }
}
module.exports = connectionHandler;