'use strict';
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;
const START_SEARCH_NO = 'START_SEARCH_NO';
const START_SEARCH_YES = 'START_SEARCH_YES';
const GREETING = 'GREETING';
const AUSTRALIA_YES = 'AUSTRALIA_YES';
const AUSTRALIA_LOCATION_PROVIDED = 'AUSTRALIA_LOCATION_PROVIDED';
const PREFERENCE_PROVIDED = 'PREFERENCE_PROVIDED';
const PREF_CLEANUP = 'PREF_CLEANUP';
const PREF_REVEGETATION = 'PREF_REVEGETATION';
const PREF_BIO_SURVEY = 'PREF_BIO_SURVEY';
const PREF_CANVASSING = 'PREF_CANVASSING';
const AUSTRALIA_NO = 'AUSTRALIA_NO';
const OTHER_HELP_YES = 'OTHER_HELP_YES';
const FACEBOOK_GRAPH_API_BASE_URL = 'https://graph.facebook.com/v2.6/';
const MONGODB_URI = process.env.MONGODB_URI;

const
  request = require('request'),
  express = require('express'),
  body_parser = require('body-parser'),
  mongoose = require('mongoose'),
  app = express().use(body_parser.json()); // creates express http server

 var db = mongoose.connect(MONGODB_URI);
 var ChatStatus = require("./models/chatstatus");

// Sets server port and logs message on success
app.listen(process.env.PORT || 1337, () => console.log('webhook is listening'));

// Accepts POST requests at /webhook endpoint
app.post('/webhook', (req, res) => {

  // Return a '200 OK' response to all events
  res.status(200).send('EVENT_RECEIVED');

  const body = req.body;

  if (body.object === 'page') {
      // Iterate over each entry
      // There may be multiple if batched
      if (!body.entry){
        return;
      }
      body.entry.forEach((pageEntry) => {
        // Iterate over each messaging event and handle accordingly
        pageEntry.messaging.forEach((messagingEvent) => {
          console.log({messagingEvent});
          if (messagingEvent.postback) {
            handlePostback(messagingEvent.sender.id, messagingEvent.postback);
          } else if (messagingEvent.message) {
            if (messagingEvent.message.quick_reply){
              handlePostback(messagingEvent.sender.id, messagingEvent.message.quick_reply);
            } else{
              handleMessage(messagingEvent.sender.id, messagingEvent.message);
            }
          } else {
            console.log(
              'Webhook received unknown messagingEvent: ',
              messagingEvent
            );
          }
        });
      });
    }
});

// Accepts GET requests at the /webhook endpoint
app.get('/webhook', (req, res) => {

  /** UPDATE YOUR VERIFY TOKEN **/
  const VERIFY_TOKEN = process.env.VERIFICATION_TOKEN;

  // Parse params from the webhook verification request
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];

  // Check if a token and mode were sent
  if (mode && token) {

    // Check the mode and token sent are correct
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {

      // Respond with 200 OK and challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      res.status(200).send(challenge);

    } else {
      // Responds with '403 Forbidden' if verify tokens do not match
      res.sendStatus(403);
    }
  }
});

function handleMessage(sender_psid, message) {
  // check if it is a location message
  let response;
  console.log('handleMEssage message:', JSON.stringify(message));

  const locationAttachment = message && message.attachments && message.attachments.find(a => a.type === 'location');
  console.log('handleMEssage locationAttachment:', JSON.stringify(locationAttachment));

  const coordinates = locationAttachment && locationAttachment.payload && locationAttachment.payload.coordinates;
  console.log('handleMEssage coordinates:', JSON.stringify(coordinates));

  if (coordinates && !isNaN(coordinates.lat) && !isNaN(coordinates.long)){
    const query = {'user_id': sender_psid, 'status': AUSTRALIA_YES };
    const update = {
      $set: { "location.lat": 10, "location.long": 10, status: AUSTRALIA_LOCATION_PROVIDED }
    };
    const options = {upsert: true, new: true};

    ChatStatus.findOneAndUpdate(query, update, options, (err, cs) => {
      console.log('handleMessage update coordinates:', cs);
      if (err){
        console.log('Error in updating coordinates:', err);
      } else if (cs){
        response = {
          "attachment": {
            "type": "template",
            "payload": {
              "template_type": "list",
              "top_element_style": "compact",
              "elements": [
                {
                  "title": "Environmental Cleanup",
                  "subtitle": "Clean environment",
                  "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-bait-reef-coral-bleaching-rubble-1000px.jpg",
                  "buttons": [
                    {
                      type: "postback",
                      title: "Go Environmental Cleanup",
                      payload: PREF_CLEANUP
                    }
                  ]
                }, {
                  "title": "Revegetation",
                  "subtitle": "Revegetation",
                  "image_url": "http://www.wwf.org.au//Images/UserUploadedImages/416/img-planet-globe-on-moss-forest-1000px.jpg",
                  "buttons": [
                    {
                      type: "postback",
                      title: "Go Revegetation",
                      payload: PREF_REVEGETATION
                    }
                  ]
                }, {
                  "title": "Bio Survey",
                  "subtitle": "Bio Survey",
                  "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-koala-in-tree-1000px.jpg",
                  "buttons": [
                    {
                      type: "postback",
                      title: "Go Bio Survey",
                      payload: PREF_BIO_SURVEY
                    }
                  ]
                }, {
                  "title": "Canvassing",
                  "subtitle": "Canvassing",
                  "image_url": "http://www.wwf.org.au/Images/UserUploadedImages/416/img-hackathon-winners-2017-1000px.jpg",
                  "buttons": [
                    {
                      type: "postback",
                      title: "Go Canvassing",
                      payload: PREF_CANVASSING
                    }
                  ]
                }
              ]
            }
          }
        };
        callSendAPI(sender_psid, response);
      }
    });
  }
}

function handleStartSearchYesPostback(sender_psid){
  const yesPayload = {
    "text": " Ok, I have to get to know you a little bit more for this. Do you live in Australia?",
    "quick_replies":[
      {
        "content_type":"text",
        "title":"Yes!",
        "payload": AUSTRALIA_YES
      },
      {
        "content_type":"text",
        "title":"Nope.",
        "payload": AUSTRALIA_NO
      }
    ]
  };
  callSendAPI(sender_psid, yesPayload);
}

function handleStartSearchNoPostback(sender_psid){
  const noPayload = {
    "text": "That's ok my friend, do you want to find other ways to help WWF?",
    "quick_replies":[
      {
        "content_type":"text",
        "title":"Yes.",
        "payload": OTHER_HELP_YES
      }
    ]
  };
  callSendAPI(sender_psid, noPayload);
}

function handleOtherHelpPostback(sender_psid){
  const campaigns = {
    "attachment":{
       "type":"template",
       "payload":{
         "template_type":"generic",
         "elements":[
            {
             "title":"We need your help",
             "image_url":"http://awsassets.panda.org/img/original/wwf_infographic_tropical_deforestation.jpg",
             "subtitle":"to save our natural world",
             "buttons":[
               {
                 "type":"web_url",
                 "url":"https://donate.wwf.org.au/campaigns/rhinoappeal/",
                 "title":"Javan Rhino Appeal"
               },{
                 "type":"web_url",
                 "url":"https://donate.wwf.org.au/campaigns/donate/#AD",
                 "title":"Adopt an Animal"
               },{
                 "type":"web_url",
                 "url":"https://donate.wwf.org.au/campaigns/wildcards/",
                 "title":"Send a wildcard"
               }
             ]
           }
         ]
       }
     }
  };
  callSendAPI(sender_psid, campaigns);
}

function handleGreetingPostback(sender_psid){
  request({
    url: `${FACEBOOK_GRAPH_API_BASE_URL}${sender_psid}`,
    qs: {
      access_token: process.env.PAGE_ACCESS_TOKEN,
      fields: "first_name"
    },
    method: "GET"
  }, function(error, response, body) {
    var greeting = "";
    if (error) {
      console.log("Error getting user's name: " +  error);
    } else {
      var bodyObj = JSON.parse(body);
      const name = bodyObj.first_name;
      greeting = "Hi " + name + ". ";
    }
    const message = greeting + "Would you like to join a community of like-minded pandas in your area?";
    const greetingPayload = {
      "text": message,
      "quick_replies":[
        {
          "content_type":"text",
          "title":"Yes!",
          "payload": START_SEARCH_YES
        },
        {
          "content_type":"text",
          "title":"No, thanks.",
          "payload": START_SEARCH_NO
        }
      ]
    };
    callSendAPI(sender_psid, greetingPayload);
  });
}

function handleAustraliaYesPostback(sender_psid){
  const askForLocationPayload = {
    "text": "Where about do you live?",
    "quick_replies":[
      {
        "content_type":"location"
      }
    ]
  };
  callSendAPI(sender_psid, askForLocationPayload);
}

function handlePreferencePostback(sender_psid, chatStatus){
  console.log('handlePreferencePostback params: ', chatStatus);
  if (chatStatus){
    request({
      "url": `${FACEBOOK_GRAPH_API_BASE_URL}search?type=page&q=NonProfit+Australia&fields=name,id,category,location&center=-33.8876,151.19837&distance=1000`,
      "qs": { "access_token": PAGE_ACCESS_TOKEN },
      "method": "GET"
    }, (err, res, body) => {
      console.log("PREF_CANVASSING Response res:", res);
      console.log("PREF_CANVASSING Response body:", body);
      if (err) {
        console.error("Unable to PREF_CANVASSING:" + err);
      }
      // callSendAPI(sender_psid, greetingPayload);
    });
  }
}

function updateStatus(sender_psid, status, callback){
  const query = {user_id: sender_psid};
  const update = {status: status};
  const options = {upsert: true};

  ChatStatus.findOneAndUpdate(query, update, options).exec((err, cs) => {
    console.log('update status to db: ', cs);
    callback(sender_psid);
  });
}

function updatePreference(sender_psid, perference, callback){
  const query = {user_id: sender_psid};
  const update = {status: 'PREFERENCE_PROVIDED', preference: perference};
  const options = {upsert: true, new: true};

  ChatStatus.findOneAndUpdate(query, update, options).exec((err, cs) => {
    console.log('update perference to db: ', cs);
    callback(sender_psid, cs);
  });
}

function handlePostback(sender_psid, received_postback) {
  // Get the payload for the postback
  const payload = received_postback.payload;

  // Set the response and udpate db based on the postback payload
  switch (payload){
    case START_SEARCH_YES:
      updateStatus(sender_psid, payload, handleStartSearchYesPostback);
      break;
    case START_SEARCH_NO:
      updateStatus(sender_psid, payload, handleStartSearchNoPostback);
      break;
    case OTHER_HELP_YES:
      updateStatus(sender_psid, payload, handleOtherHelpPostback);
      break;
    case AUSTRALIA_YES:
      updateStatus(sender_psid, payload, handleAustraliaYesPostback);
      break;
    case GREETING:
      updateStatus(sender_psid, payload, handleGreetingPostback);
      break;
    case PREF_CANVASSING:
      updatePreference(sender_psid, payload, handlePreferencePostback);

      break;
    default:
      console.log('Cannot differentiate the payload type');
  }
}

function callSendAPI(sender_psid, response) {
  // Construct the message body
  console.log('message to be sent: ', response);
  let request_body = {
    "recipient": {
      "id": sender_psid
    },
    "message": response
  }

  // Send the HTTP request to the Messenger Platform
  request({
    "url": `${FACEBOOK_GRAPH_API_BASE_URL}me/messages`,
    "qs": { "access_token": PAGE_ACCESS_TOKEN },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    console.log("Message Sent Response body:", body);
    if (err) {
      console.error("Unable to send message:", err);
    }
  });
}
