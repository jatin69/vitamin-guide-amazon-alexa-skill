// Lambda Function code for Alexa.
// Paste this into your index.js file. 

const Alexa = require("ask-sdk");
const https = require("https");
const welcomeView = require("./welcomeView.json");
const helpView = require("./helpView.json");
const bVitaminView = require("./bVitaminView.json");
const mainView = require("./mainView.json");
const byeView = require("./byeView.json");
const sp = require("./speechDB.json");

const vitaminDB = require("./vitaminDB.json");


const invocationName = sp.invocationName;

// Session Attributes 
//   Alexa will track attributes for you, by default only during the lifespan of your session.
//   The history[] array will track previous request(s), used for contextual Help/Yes/No handling.
//   Set up DynamoDB persistence to have the skill save and reload these attributes between skill sessions.

function getMemoryAttributes() {
    const memoryAttributes = {
        "history": [],

        // The remaining attributes will be useful after DynamoDB persistence is configured
        "launchCount": 0,
        "lastUseTimestamp": 0,

        "lastSpeechOutput": {},
        "nextIntent": [],

        "wasLaunchIntentActivated": 0

        // "favoriteColor":"",
        // "name":"",
        // "namePronounce":"",
        // "email":"",
        // "mobileNumber":"",
        // "city":"",
        // "state":"",
        // "postcode":"",
        // "birthday":"",
        // "bookmark":0,
        // "wishlist":[],
    };
    return memoryAttributes;
};

const maxHistorySize = 20; // remember only latest 20 intents 


// 1. Intent Handlers =============================================

const AMAZON_FallbackIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let previousSpeech = getPreviousSpeechOutput(sessionAttributes);

        return responseBuilder
            .speak(sp.didNotUnderstand)
            .reprompt(sp.reprompt)
            .getResponse();
    },
};

const AMAZON_CancelIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.CancelIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();


        let say = sp.bye;
        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: byeView.document,
                    datasources: byeView.dataSources
                })
                .withShouldEndSession(true)
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .withShouldEndSession(true)
                .getResponse();
        }

    },
};

const AMAZON_HelpIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let intents = getCustomIntents();
        let sampleIntent = randomElement(intents);

        let say = '';

        // let previousIntent = getPreviousIntent(sessionAttributes);
        // if (previousIntent && !handlerInput.requestEnvelope.session.new) {
        //     say += 'Your last intent was ' + previousIntent + '. ';
        // }
        // say +=  'I understand  ' + intents.length + ' intents, '

        say += sp.help;

        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .reprompt(sp.reprompt)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: helpView.document,
                    datasources: helpView.dataSources
                })
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .reprompt(sp.reprompt)
                .getResponse();
        }

    },
};

const AMAZON_StopIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.StopIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = sp.bye;

        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: byeView.document,
                    datasources: byeView.dataSources
                })
                .withShouldEndSession(true)
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .withShouldEndSession(true)
                .getResponse();
        }
    },
};

const AMAZON_NavigateHomeIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NavigateHomeIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = sp.welcome;


        return responseBuilder
            .speak(say)
            .reprompt(sp.reprompt)
            .getResponse();
    },
};

const askAboutVitamin_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'askAboutVitamin';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        // delegate to Alexa to collect all the required slots 
        const currentIntent = request.intent;
        if (request.dialogState && request.dialogState !== 'COMPLETED') {
            console.log("PROBLEM ");
            return handlerInput.responseBuilder
                .addDelegateDirective(currentIntent)
                .getResponse();

        }

        let say = '';
        // console.log(welcomeView);
        let slotStatus = '';
        let resolvedSlot;

        let slotValues = getSlotValues(request.intent.slots);
        // getSlotValues returns .heardAs, .resolved, and .isValidated for each slot, according to request slot status codes ER_SUCCESS_MATCH, ER_SUCCESS_NO_MATCH, or traditional simple request slot without resolutions

        // console.log('***** slotValues: ' +  JSON.stringify(slotValues, null, 2));
        //   SLOT: VitaminsList 
        if (slotValues.VitaminsList.heardAs) {
            slotStatus += ' slot VitaminsList was heard as ' + slotValues.VitaminsList.heardAs + '. ';
        } else {
            slotStatus += 'slot VitaminsList is empty. ';
        }
        if (slotValues.VitaminsList.ERstatus === 'ER_SUCCESS_MATCH') {
            slotStatus += 'a valid ';
            if (slotValues.VitaminsList.resolved !== slotValues.VitaminsList.heardAs) {
                slotStatus += 'synonym for ' + slotValues.VitaminsList.resolved + '. ';
            } else {
                slotStatus += 'match. '
            } // else {
            //
        }
        if (slotValues.VitaminsList.ERstatus === 'ER_SUCCESS_NO_MATCH') {
            slotStatus += 'which did not match any slot value. ';
            console.log('***** consider adding "' + slotValues.VitaminsList.heardAs + '" to the custom slot type used by slot VitaminsList! ');
        }

        if ((slotValues.VitaminsList.ERstatus === 'ER_SUCCESS_NO_MATCH') || (!slotValues.VitaminsList.heardAs)) {
            slotStatus += 'A few valid values are, ' + sayArray(getExampleSlotValues('askAboutVitamin', 'VitaminsList'), 'or');
        }

        // say += slotStatus;

        let askedVitamin = vitaminDB[slotValues.VitaminsList.resolved];

        say += "You asked about " + askedVitamin.name + " . " + askedVitamin.uses + ' ' + askedVitamin.sources + ' ';

        const customData = {
            "bodyTemplate3Data": {
                "type": "object",
                "objectId": "bt3Sample",
                "backgroundImage": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [{
                            "url": "https://s3.amazonaws.com/vitamin-guide/background_1024x600.jpg",
                            "size": "small",
                            "widthPixels": 0,
                            "heightPixels": 0
                        },
                        {
                            "url": "https://s3.amazonaws.com/vitamin-guide/background_1024x600.jpg",
                            "size": "large",
                            "widthPixels": 0,
                            "heightPixels": 0
                        }
                    ]
                },
                "title": "Vitamin Guide",
                "image": {
                    "contentDescription": null,
                    "smallSourceUrl": null,
                    "largeSourceUrl": null,
                    "sources": [{
                            "url": askedVitamin.imageURL,
                            "size": "small",
                            "widthPixels": 0,
                            "heightPixels": 0
                        },
                        {
                            "url": askedVitamin.imageURL,
                            "size": "large",
                            "widthPixels": 0,
                            "heightPixels": 0
                        }
                    ]
                },
                "textContent": {
                    "title": {
                        "type": "PlainText",
                        "text": askedVitamin.name
                    },
                    "primaryText": {
                        "type": "PlainText",
                        "text": askedVitamin.uses
                    },
                    "bulletPoint": {
                        "type": "PlainText",
                        "text": askedVitamin.sources
                    }
                },
                "logoUrl": "https://s3.amazonaws.com/vitamin-guide/vitamin-guide-icon-54x62.png",
                "hintText": "Try, \"Tell me about Vitamin A\""
            }
        };

        if (askedVitamin.name == 'Vitamin B') {
            say += sp.vitaminBInfo;
            say += sp.continueSessionForVitaminB;
            if (supportsAPL(handlerInput)) {
                return responseBuilder
                    .speak(say)
                    .reprompt(sp.continueSessionForVitaminB)
                    .addDirective({
                        type: 'Alexa.Presentation.APL.RenderDocument',
                        version: '1.0',
                        document: bVitaminView.document,
                        datasources: bVitaminView.dataSources
                    })
                    .getResponse();
            } else {
                return responseBuilder
                    .speak(say)
                    .reprompt(sp.continueSessionForVitaminB)
                    .getResponse();
            }
        } else {
            let session_attr = handlerInput.attributesManager.getSessionAttributes();
            if (session_attr["wasLaunchIntentActivated"] == 1) {
                say += sp.continueSession;
                if (supportsAPL(handlerInput)) {
                    return responseBuilder
                        .speak(say)
                        .reprompt(sp.continueSessionReprompt)
                        .addDirective({
                            type: 'Alexa.Presentation.APL.RenderDocument',
                            version: '1.0',
                            document: mainView.document,
                            datasources: customData
                        })
                        .getResponse();
                } else {
                    return responseBuilder
                        .speak(say)
                        .reprompt(sp.continueSessionReprompt)
                        .getResponse();
                }
            } else {
                if (supportsAPL(handlerInput)) {
                    return responseBuilder
                        .speak(say)
                        .addDirective({
                            type: 'Alexa.Presentation.APL.RenderDocument',
                            version: '1.0',
                            document: mainView.document,
                            datasources: customData
                        })
                        .withShouldEndSession(true)
                        .getResponse();
                } else {
                    return responseBuilder
                        .speak(say)
                        .withShouldEndSession(true)
                        .getResponse();
                }
            }



        }


    },
};



const AMAZON_YesIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.YesIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = 'You said Yes. ';
        // let previousIntent = getPreviousIntent(sessionAttributes);

        // if (previousIntent && !handlerInput.requestEnvelope.session.new) {
        // say += 'Your last intent was ' + previousIntent + '. ';
        // }
        say += sp.askMore;

        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .reprompt(sp.continueSession)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: helpView.document,
                    datasources: helpView.dataSources
                })
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .reprompt(sp.continueSession)
                .getResponse();
        }

    },
};

const AMAZON_NoIntent_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'IntentRequest' && request.intent.name === 'AMAZON.NoIntent';
    },
    handle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        const responseBuilder = handlerInput.responseBuilder;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let say = 'You said No. ' + sp.bye;

        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: byeView.document,
                    datasources: byeView.dataSources
                })
                .withShouldEndSession(true)
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .withShouldEndSession(true)
                .getResponse();
        }
    },
};


const LaunchRequest_Handler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const responseBuilder = handlerInput.responseBuilder;

        // increment this
        let session_attr = handlerInput.attributesManager.getSessionAttributes();
        session_attr["wasLaunchIntentActivated"] = 1;
        handlerInput.attributesManager.setSessionAttributes(session_attr);

        let say = 'Hello' + ' and welcome to ' + invocationName + ' ! ';
        say += sp.welcome;

        let skillTitle = capitalize(invocationName);

        if (supportsAPL(handlerInput)) {
            return responseBuilder
                .speak(say)
                .reprompt(sp.reprompt)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: welcomeView.document,
                    datasources: welcomeView.dataSources
                })
                .getResponse();
        } else {
            return responseBuilder
                .speak(say)
                .reprompt(sp.reprompt)
                .getResponse();
        }

    },
};

const SessionEndedHandler = {
    canHandle(handlerInput) {
        const request = handlerInput.requestEnvelope.request;
        return request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`Session ended with reason: ${handlerInput.requestEnvelope.request.reason}`);
        return handlerInput.responseBuilder.getResponse();
    }
};

const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const request = handlerInput.requestEnvelope.request;

        console.log(`Error handled: ${error.message}`);
        // console.log(`Original Request was: ${JSON.stringify(request, null, 2)}`);

        if (supportsAPL(handlerInput)) {
            return handlerInput.responseBuilder
                .speak(sp.didNotUnderstand)
                .reprompt(sp.reprompt)
                .addDirective({
                    type: 'Alexa.Presentation.APL.RenderDocument',
                    version: '1.0',
                    document: helpView.document,
                    datasources: helpView.dataSources
                })
                .getResponse();
        } else {
            return handlerInput.responseBuilder
                .speak(sp.didNotUnderstand)
                .reprompt(sp.reprompt)
                .getResponse();
        }

    }
};


// 2. Constants ===========================================================================

// Here you can define static data, to be used elsewhere in your code.  For example: 
//    const myString = "Hello World";
//    const myArray  = [ "orange", "grape", "strawberry" ];
//    const myObject = { "city": "Boston",  "state":"Massachusetts" };

const APP_ID = "amzn1.ask.skill.9c83d984-a4d8-4ecd-a8b9-64af5d24e065"; // TODO replace with your Skill ID (OPTIONAL).

// 3.  Helper Functions ===================================================================

//  function to check APL support
function supportsAPL(handlerInput) {
    const supportedInterfaces = handlerInput.requestEnvelope.context.System.device.supportedInterfaces;
    const aplInterface = supportedInterfaces['Alexa.Presentation.APL'];
    return aplInterface != null && aplInterface != undefined;
}

function capitalize(myString) {

    return myString.replace(/(?:^|\s)\S/g, function (a) {
        return a.toUpperCase();
    });
}


function randomElement(myArray) {
    return (myArray[Math.floor(Math.random() * myArray.length)]);
}

function stripSpeak(str) {
    return (str.replace('<speak>', '').replace('</speak>', ''));
}

function getSlotValues(filledSlots) {
    const slotValues = {};

    Object.keys(filledSlots).forEach((item) => {
        const name = filledSlots[item].name;

        if (filledSlots[item] &&
            filledSlots[item].resolutions &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0] &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status &&
            filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
            switch (filledSlots[item].resolutions.resolutionsPerAuthority[0].status.code) {
                case 'ER_SUCCESS_MATCH':
                    slotValues[name] = {
                        heardAs: filledSlots[item].value,
                        resolved: filledSlots[item].resolutions.resolutionsPerAuthority[0].values[0].value.name,
                        ERstatus: 'ER_SUCCESS_MATCH'
                    };
                    break;
                case 'ER_SUCCESS_NO_MATCH':
                    slotValues[name] = {
                        heardAs: filledSlots[item].value,
                        resolved: '',
                        ERstatus: 'ER_SUCCESS_NO_MATCH'
                    };
                    break;
                default:
                    break;
            }
        } else {
            slotValues[name] = {
                heardAs: filledSlots[item].value,
                resolved: '',
                ERstatus: ''
            };
        }
    }, this);

    return slotValues;
}

function getExampleSlotValues(intentName, slotName) {

    let examples = [];
    let slotType = '';
    let slotValuesFull = [];

    let intents = model.interactionModel.languageModel.intents;
    for (let i = 0; i < intents.length; i++) {
        if (intents[i].name == intentName) {
            let slots = intents[i].slots;
            for (let j = 0; j < slots.length; j++) {
                if (slots[j].name === slotName) {
                    slotType = slots[j].type;

                }
            }
        }

    }
    let types = model.interactionModel.languageModel.types;
    for (let i = 0; i < types.length; i++) {
        if (types[i].name === slotType) {
            slotValuesFull = types[i].values;
        }
    }


    examples.push(slotValuesFull[0].name.value);
    examples.push(slotValuesFull[1].name.value);
    if (slotValuesFull.length > 2) {
        examples.push(slotValuesFull[2].name.value);
    }


    return examples;
}

function sayArray(myData, penultimateWord = 'and') {
    let result = '';

    myData.forEach(function (element, index, arr) {

        if (index === 0) {
            result = element;
        } else if (index === myData.length - 1) {
            result += ` ${penultimateWord} ${element}`;
        } else {
            result += `, ${element}`;
        }
    });
    return result;
}

function supportsDisplay(handlerInput) // returns true if the skill is running on a device with a display (Echo Show, Echo Spot, etc.) 
{ //  Enable your skill for display as shown here: https://alexa.design/enabledisplay 
    const hasDisplay =
        handlerInput.requestEnvelope.context &&
        handlerInput.requestEnvelope.context.System &&
        handlerInput.requestEnvelope.context.System.device &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces &&
        handlerInput.requestEnvelope.context.System.device.supportedInterfaces.Display;

    return hasDisplay;
}


const welcomeCardImg = {
    smallImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane720_480.png",
    largeImageUrl: "https://s3.amazonaws.com/skill-images-789/cards/card_plane1200_800.png"


};

const DisplayImg1 = {
    title: 'Jet Plane',
    url: 'https://s3.amazonaws.com/skill-images-789/display/plane340_340.png'
};
const DisplayImg2 = {
    title: 'Starry Sky',
    url: 'https://s3.amazonaws.com/skill-images-789/display/background1024_600.png'

};

function getCustomIntents() {
    const modelIntents = model.interactionModel.languageModel.intents;

    let customIntents = [];


    for (let i = 0; i < modelIntents.length; i++) {

        if (modelIntents[i].name.substring(0, 7) != "AMAZON." && modelIntents[i].name !== "LaunchRequest") {
            customIntents.push(modelIntents[i]);
        }
    }
    return customIntents;
}

function getSampleUtterance(intent) {

    return randomElement(intent.samples);

}

function getPreviousIntent(attrs) {

    if (attrs.history && attrs.history.length > 1) {
        return attrs.history[attrs.history.length - 2].IntentRequest;

    } else {
        return false;
    }

}

function getPreviousSpeechOutput(attrs) {

    if (attrs.lastSpeechOutput && attrs.history.length > 1) {
        return attrs.lastSpeechOutput;

    } else {
        return false;
    }

}

function timeDelta(t1, t2) {

    const dt1 = new Date(t1);
    const dt2 = new Date(t2);
    const timeSpanMS = dt2.getTime() - dt1.getTime();
    const span = {
        "timeSpanMIN": Math.floor(timeSpanMS / (1000 * 60)),
        "timeSpanHR": Math.floor(timeSpanMS / (1000 * 60 * 60)),
        "timeSpanDAY": Math.floor(timeSpanMS / (1000 * 60 * 60 * 24)),
        "timeSpanDesc": ""
    };


    if (span.timeSpanHR < 2) {
        span.timeSpanDesc = span.timeSpanMIN + " minutes";
    } else if (span.timeSpanDAY < 2) {
        span.timeSpanDesc = span.timeSpanHR + " hours";
    } else {
        span.timeSpanDesc = span.timeSpanDAY + " days";
    }


    return span;

}


const InitMemoryAttributesInterceptor = {
    process(handlerInput) {
        let sessionAttributes = {};
        if (handlerInput.requestEnvelope.session['new']) {

            sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            let memoryAttributes = getMemoryAttributes();

            if (Object.keys(sessionAttributes).length === 0) {

                Object.keys(memoryAttributes).forEach(function (key) { // initialize all attributes from global list 

                    sessionAttributes[key] = memoryAttributes[key];

                });

            }
            handlerInput.attributesManager.setSessionAttributes(sessionAttributes);


        }
    }
};

const RequestHistoryInterceptor = {
    process(handlerInput) {

        const thisRequest = handlerInput.requestEnvelope.request;
        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

        let history = sessionAttributes['history'] || [];

        let IntentRequest = {};
        if (thisRequest.type === 'IntentRequest') {

            let slots = [];

            IntentRequest = {
                'IntentRequest': thisRequest.intent.name
            };

            if (thisRequest.intent.slots) {

                for (let slot in thisRequest.intent.slots) {
                    let slotObj = {};
                    slotObj[slot] = thisRequest.intent.slots[slot].value;
                    slots.push(slotObj);
                }

                IntentRequest = {
                    'IntentRequest': thisRequest.intent.name,
                    'slots': slots
                };

            }

        } else {
            IntentRequest = {
                'IntentRequest': thisRequest.type
            };
        }
        if (history.length > maxHistorySize - 1) {
            history.shift();
        }
        history.push(IntentRequest);

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    }

};




const RequestPersistenceInterceptor = {
    process(handlerInput) {

        if (handlerInput.requestEnvelope.session['new']) {

            return new Promise((resolve, reject) => {

                handlerInput.attributesManager.getPersistentAttributes()

                    .then((sessionAttributes) => {
                        sessionAttributes = sessionAttributes || {};


                        sessionAttributes['launchCount'] += 1;

                        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

                        handlerInput.attributesManager.savePersistentAttributes()
                            .then(() => {
                                resolve();
                            })
                            .catch((err) => {
                                reject(err);
                            });
                    });

            });

        } // end session['new'] 
    }
};


const ResponseRecordSpeechOutputInterceptor = {
    process(handlerInput, responseOutput) {

        let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
        let lastSpeechOutput = {
            "outputSpeech": responseOutput.outputSpeech.ssml,
            "reprompt": responseOutput.reprompt.outputSpeech.ssml
        };

        sessionAttributes['lastSpeechOutput'] = lastSpeechOutput;

        handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

    }
};

const ResponsePersistenceInterceptor = {
    process(handlerInput, responseOutput) {

        const ses = (typeof responseOutput.shouldEndSession == "undefined" ? true : responseOutput.shouldEndSession);

        if (ses || handlerInput.requestEnvelope.request.type == 'SessionEndedRequest') { // skill was stopped or timed out 

            let sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

            sessionAttributes['lastUseTimestamp'] = new Date(handlerInput.requestEnvelope.request.timestamp).getTime();

            handlerInput.attributesManager.setPersistentAttributes(sessionAttributes);

            return new Promise((resolve, reject) => {
                handlerInput.attributesManager.savePersistentAttributes()
                    .then(() => {
                        resolve();
                    })
                    .catch((err) => {
                        reject(err);
                    });

            });

        }

    }
};



// 4. Exports handler function and setup ===================================================
const skillBuilder = Alexa.SkillBuilders.standard();
exports.handler = skillBuilder
    .addRequestHandlers(
        AMAZON_FallbackIntent_Handler,
        AMAZON_CancelIntent_Handler,
        AMAZON_HelpIntent_Handler,
        AMAZON_StopIntent_Handler,
        AMAZON_NavigateHomeIntent_Handler,
        askAboutVitamin_Handler,
        AMAZON_YesIntent_Handler,
        AMAZON_NoIntent_Handler,
        LaunchRequest_Handler,
        SessionEndedHandler
    )
    .addErrorHandlers(ErrorHandler)
    .addRequestInterceptors(InitMemoryAttributesInterceptor)
    .addRequestInterceptors(RequestHistoryInterceptor)

    // .addResponseInterceptors(ResponseRecordSpeechOutputInterceptor)

    // .addRequestInterceptors(RequestPersistenceInterceptor)
    // .addResponseInterceptors(ResponsePersistenceInterceptor)

    // .withTableName("askMemorySkillTable")
    // .withAutoCreateTable(true)

    .lambda();


// End of Skill code -------------------------------------------------------------
// Static Language Model for reference

const model = {
    "interactionModel": {
        "languageModel": {
            "invocationName": "vitamin guide",
            "intents": [
                {
                    "name": "AMAZON.FallbackIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.CancelIntent",
                    "samples": []
                },
                {
                    "name": "AMAZON.HelpIntent",
                    "samples": [
                        "open vitamin guide",
                        "vitamin guide",
                        "alexa open vitamin guide"
                    ]
                },
                {
                    "name": "AMAZON.StopIntent",
                    "samples": [
                        "abort",
                        "take me out",
                        "i want to exit",
                        "i want to quit",
                        "i wanna exit",
                        "goodbye",
                        "i quit",
                        "quit",
                        "exit",
                        "bye",
                        "thats all",
                        "thank you",
                        "that would be all"
                    ]
                },
                {
                    "name": "AMAZON.NavigateHomeIntent",
                    "samples": []
                },
                {
                    "name": "askAboutVitamin",
                    "slots": [
                        {
                            "name": "VitaminsList",
                            "type": "vitaminsList"
                        }
                    ],
                    "samples": [
                        "{VitaminsList}",
                        "Tell me about {VitaminsList}",
                        "Tell me about Vitamin {VitaminsList}",
                        "Vitamin {VitaminsList}"
                    ]
                },
                {
                    "name": "AMAZON.YesIntent",
                    "samples": [
                        "yeah",
                        "yep"
                    ]
                },
                {
                    "name": "AMAZON.NoIntent",
                    "samples": [
                        "nah",
                        "nope"
                    ]
                }
            ],
            "types": [
                {
                    "name": "vitaminsList",
                    "values": [
                        {
                            "name": {
                                "value": "B",
                                "synonyms": [
                                    "b",
                                    "b."
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 9",
                                "synonyms": [
                                    "b9",
                                    "b. nine",
                                    "Folic acid",
                                    "Folinic acid",
                                    "folate"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 7",
                                "synonyms": [
                                    "b7",
                                    "b. seven",
                                    "biotin"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 12",
                                "synonyms": [
                                    "b12",
                                    "b. twelve",
                                    "Hydroxycobalamin",
                                    "cobalamins",
                                    "methylcobalamin",
                                    "cyanocobalamin"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 6",
                                "synonyms": [
                                    "b6",
                                    "b. six",
                                    " pyridoxal",
                                    "pyridoxamine",
                                    "pyridoxine"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 5",
                                "synonyms": [
                                    "b5",
                                    "b. five",
                                    "pantothenic acid"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 3",
                                "synonyms": [
                                    "b3",
                                    "b. three",
                                    "riboside",
                                    "Tryptophan",
                                    "nicotinic acid",
                                    "nicotinamide",
                                    "niacin"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 2",
                                "synonyms": [
                                    "b2",
                                    "b. two",
                                    "Riboflavin"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "K",
                                "synonyms": [
                                    "Menaquinones",
                                    "Phylloquinone"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "E",
                                "synonyms": [
                                    "Tocotrienols",
                                    "Tocopherols"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "D",
                                "synonyms": [
                                    "Cholecalciferol",
                                    "Ergocalciferol"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "C",
                                "synonyms": [
                                    "Ascorbic acid"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "B 1",
                                "synonyms": [
                                    "b1",
                                    "b. one",
                                    "Thiamin"
                                ]
                            }
                        },
                        {
                            "name": {
                                "value": "A",
                                "synonyms": [
                                    "Retinol",
                                    "Retinal"
                                ]
                            }
                        }
                    ]
                }
            ]
        },
        "dialog": {
            "intents": [
                {
                    "name": "askAboutVitamin",
                    "delegationStrategy": "SKILL_RESPONSE",
                    "confirmationRequired": false,
                    "prompts": {},
                    "slots": [
                        {
                            "name": "VitaminsList",
                            "type": "vitaminsList",
                            "confirmationRequired": false,
                            "elicitationRequired": true,
                            "prompts": {
                                "elicitation": "Elicit.Slot.780749748528.289742811129"
                            }
                        }
                    ]
                }
            ],
            "delegationStrategy": "ALWAYS"
        },
        "prompts": [
            {
                "id": "Elicit.Slot.780749748528.289742811129",
                "variations": [
                    {
                        "type": "PlainText",
                        "value": "Which Vitamin do you want to know about ?"
                    }
                ]
            }
        ]
    }
};