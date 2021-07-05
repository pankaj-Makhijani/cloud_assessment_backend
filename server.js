const express= require('express');
const bodyParser=require('body-parser');
const cors=require('cors');
const nodemailer = require('nodemailer');
const fs = require('fs');
require('dotenv').config('./.env');
const S3 = require("aws-sdk/clients/s3");
const path = require('path')

//Authorozing or initializing nodemailer
var transporter = nodemailer.createTransport({
  service: process.env.MAIL_SERVICE,
  auth: {
    user: process.env.MAIL_SENDER,
    pass: process.env.MAIL_PASSWORD
  }
});

//Creating S3 bucket object
const s3 = new S3({
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
});

// Load the AWS SDK for Node.js
var AWS = require('aws-sdk');
// Set the region 
AWS.config.update({region: 'REGION'});


const app=express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

var mysql = require('mysql');
 
// create a connection variable with the required details
var con = mysql.createConnection({
  host: process.env.DB_HOST, // ip address of server running mysql
  user: process.env.DB_USER, // user name to your mysql database
  password: process.env.DB_PASSWORD, // corresponding password
  database: process.env.DB_NAME // use the specified database
});
 
// make to connection to the database.
con.connect(function(err) {
  if (err) throw err;
  // if connection is successful
 console.log('connection successful');
});



app.get('/',(req,res)=>{
  res.json('OK');
})



app.post('/',(req,res)=>
   {
	var {name,email,mobile,age,country,photo} =req.body;
	const fileName = req.body.photo;
	var records = [[req.body.name,req.body.email,req.body.mobile,req.body.age,req.body.country]];
	// var records = [[name,email,mobile,age,country]];
	if(records[0][0]!=null)
	{
		con.query("INSERT into Users2 (name,email,mobile,age,country) VALUES ?",[records],function(err,res,fields)
		{	
		// Create an SQS service object
		var sqs = new AWS.SQS({apiVersion: '2012-11-05'});
		var params = {
   			// Remove DelaySeconds parameter and value for FIFO queues
  			DelaySeconds: 10,
			//send user email in queue body
  			MessageBody: req.body.email,
  			// MessageDeduplicationId: "TheWhistler",  // Required for FIFO queues
  			// MessageGroupId: "Group1",  // Required for FIFO queues
  			QueueUrl: process.env.QUEUE_URL
		};
		sqs.sendMessage(params, function(err, data)
		{
  			if (err)
			{
    				console.log("Error", err);
  			}
			else
			{
    				console.log("Data moved to Queue Successfully", data.MessageId);
  			}
		});
		
		if(err) throw err;
			console.log(res);
	});
   }

function uploadToS3(bucketName, keyPrefix, filePath) {
		// ex: /path/to/my-picture.png becomes my-picture.png
		var fileName = path.basename(filePath);
		var fileStream = fs.createReadStream(filePath);
	
		// If you want to save to "my-bucket/{prefix}/{filename}"
		//                    ex: "my-bucket/my-pictures-folder/my-picture.png"
		var keyName = path.join(keyPrefix, fileName);
	
		// We wrap this in a promise so that we can handle a fileStream error
		// since it can happen *before* s3 actually reads the first 'data' event
		return new Promise(function(resolve, reject) {
			fileStream.once('error', reject);
			s3.upload(
				{
					//User can upload objects but cannot view them (storing objects privately in bucket)
					Bucket: bucketName,
					Key: keyName,
					Body: fileStream,
					ContentType:'image/jpeg',
					ACL:'private'

					//If we want user to upload the object and want to provide the public link to view the image (storing objects privately in bucket)
					// Bucket: bucketName,
					// Key: keyName,
					// Body: fileStream,
					// ContentType:'image/jpeg',
					// ACL:'public-read'
					
				}
			).promise().then(resolve, reject);
		});
	}

	uploadToS3(process.env.BUCKET_NAME, req.body.name, req.body.photo).then(function (result) {
		console.log("Uploaded to s3:", result);
		console.log("Download Your Uploaded Item Here"+ result.Location);
		
	  }).catch(function (err) {
		console.error("something bad happened:", err.toString());
	  });

	var mailOptions = {
		from: process.env.MAIL_SENDER,
		to: req.body.email,
		subject: 'AWS Community',
		text: `Hello ${name}, Welcome to AWS community hope you are having a great day! You will soon receive all the details about the event.`
	  };
	  
	  transporter.sendMail(mailOptions, function(error, info){
		if (error) {
		  console.log(error);
		} else {
		  console.log('Email sent: ' + info.response);
		}
	  });

	res.json('Form submitted successfully');

})

app.listen(80,()=>{
  console.log("Port 80");
})
