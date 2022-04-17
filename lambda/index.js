'use strict';

const newman = require('newman');
const aws = require('aws-sdk');
const fs = require("fs");

exports.handler = (event, context, callback) => {
    const resultsBucket = process.env.S3_BUCKET;
    console.log(`Bucket:${resultsBucket}`);
    const resultsBucketPath = process.env.S3_BUCKET_PATH;
    console.log(`Bucket path:${resultsBucketPath}`);

    const collectionFile = process.env.POSTMAN_COLLECTION_FILE;
    console.log(`Collection file:${collectionFile}`);
    const environmentFile = process.env.POSTMAN_ENVIRONMENT_FILE;
    console.log(`Environment file:${environmentFile}`);
    const resultsFile = process.env.POSTMAN_RESULTS_FILE;
    console.log(`Results file:${resultsFile}`);

    const codeDeploy = new aws.CodeDeploy({apiVersion: '2014-10-06'});
    const resultsFilePath = `/tmp/${resultsFile}`;

    const environmentVariables = process.env;
    const variables = [];
    for (let key in environmentVariables) {
        if(key.startsWith("POSTMAN_VARIABLE_")){
            const name = key.replace("POSTMAN_VARIABLE_", "")
            const value = environmentVariables[key];
            console.log(`${key} - ${name}:${value}`);
            variables.push({
                "key": name,
                "value": value
            });
        }
    }

    newman.run(
        {
            collection: collectionFile,
            delayRequest: 10000,
            envVar: variables,
            environment: environmentFile,
            reporters: 'junitfull',
            reporter: {
                junitfull: {
                    export: resultsFilePath,
                },
            },
        },
        (newmanError, newmanData) => {
            if (resultsBucket) {
                const s3 = new aws.S3();
                const testResultsData = fs.readFileSync(resultsFilePath, 'utf8');
                s3.upload(
                    {
                        ContentType: "application/xml",
                        Bucket: resultsBucket,
                        Body: testResultsData,
                        Key: `${resultsBucketPath}/${resultsFile}`
                    },
                    function (s3Error, s3Data) {
                        if (s3Error) {
                            console.error(JSON.stringify(s3Error));
                        } else if (s3Data) {
                            console.log(JSON.stringify(s3Data));
                        } 
                        
                        if (newmanError) {// || newmanData?.run?.failures?.length) {
                            console.error(newmanError);
                            console.error(newmanData);
                            console.error(newmanData?.run?.failures);
                            const params = {
                                deploymentId: event.DeploymentId,
                                lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
                                status: 'Failed'
                            };
                            codeDeploy.putLifecycleEventHookExecutionStatus(
                                params,
                                function (codeDeployError, codeDeployData) {
                                    if (codeDeployError) {
                                        console.error(codeDeployError);
                                        callback('Validation test failed');
                                    } else {
                                        console.log(codeDeployData);
                                        callback(null, 'Validation test succeeded');
                                    }
                                });
                        } else {
                            console.log(newmanData);
                            console.log(newmanData?.run?.failures);
                            const params = {
                                deploymentId: event.DeploymentId,
                                lifecycleEventHookExecutionId: event.LifecycleEventHookExecutionId,
                                status: 'Succeeded'
                            };
                            codeDeploy.putLifecycleEventHookExecutionStatus(
                                params,
                                function (codeDeployError, codeDeployData) {
                                    if (codeDeployError) {
                                        console.error(codeDeployError);
                                        callback('Validation test failed');
                                    } else {
                                        console.log(codeDeployData);
                                        callback(null, 'Validation test succeeded');
                                    }
                                });
                        }
                    });
            }
        }
    );
}
