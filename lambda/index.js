'use strict';

const newman = require('newman');
const aws = require('aws-sdk');
const fs = require("fs");

const downloadFile = (
    bucket,
    key
) => {
    const s3 = new aws.S3();
    s3.getObject(
        {
            Bucket: bucket,
            Key: key
        })
};

const notifyCodeDeploy = (
    deploymentId,
    lifecycleEventHookExecutionId,
    status,
    callback) => {
    const params = {
        deploymentId: deploymentId,
        lifecycleEventHookExecutionId: lifecycleEventHookExecutionId,
        status: status
    };
    const codeDeploy = new aws.CodeDeploy({apiVersion: '2014-10-06'});

    codeDeploy.putLifecycleEventHookExecutionStatus(
        params,
        (codeDeployError, codeDeployData) => {
            if (codeDeployError) {
                console.error(codeDeployError);
                callback('Validation test failed');
            } else {
                console.log(codeDeployData);
                callback('Validation test succeeded');
            }
        });
}

exports.handler = (event, context, callback) => {
    console.log(`Event:${JSON.stringify(event)}`);

    const resultsBucket = process.env.S3_BUCKET;
    console.log(`Bucket:${resultsBucket}`);

    const baseBucketPath = process.env.S3_BUCKET_PATH; // time/1.1.1.1/Development/api-tests/
    console.log(`Bucket base path:${baseBucketPath}`);

    const testPath = baseBucketPath + '/' + 'tests';
    console.log(`Bucket test folder path:${testPath}`);

    const resultsPath = baseBucketPath + '/' + 'results';
    console.log(`Bucket results folder path:${resultsPath}`);

    const resultsFile = 'results.xml';
    console.log(`Results file:${resultsFile}`);

    const collectionFile = process.env.POSTMAN_COLLECTION_FILE;
    console.log(`Collection file:${collectionFile}`);
    // Download collectionFile file from S3

    const environmentFile = process.env.POSTMAN_ENVIRONMENT_FILE;
    console.log(`Environment file:${environmentFile}`);
    // Download environmentFile file from S3

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
                        Key: `${resultsPath}/${resultsFile}`
                    },
                    function (s3Error, s3Data) {
                        console.log(JSON.stringify(s3Error ? s3Error : s3Data));
                        console.log(newmanError);
                        console.log(newmanData);
                        console.log(newmanData?.run?.failures);
                        notifyCodeDeploy(
                            event.DeploymentId,
                            event.LifecycleEventHookExecutionId,
                            newmanError ? 'Failed' : 'Succeeded',
                            callback);
                    });
            }
        }
    );
}
