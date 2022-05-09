'use strict';

const newman = require('newman');
const aws = require('aws-sdk');
const fs = require("fs");
const fsPromises = require("fs").promises;

const downloadFile = async (
    bucket,
    path,
    filename) => {
    const s3 = new aws.S3();
    const object = await s3.getObject(
        {
            Bucket: bucket,
            Key: `${path}/${filename}`
        }).promise();
    const filePath = `/tmp/${filename}`
    await fsPromises.writeFile(filePath, object.Body);
    return filePath;
};

const notifyCodeDeploy = (
    deploymentId,
    lifecycleEventHookExecutionId,
    status,
    resolve,
    reject) => {
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
                if(reject){
                    reject("Failed to place lifecycle event");
                }
            } else {
                console.log(codeDeployData);
                if(resolve){
                    resolve(null, 'Successfully placed lifecycle event');
                }
            }
        });
}

exports.handler = async (event) => {
    console.log(`Event:${JSON.stringify(event)}`);

    const bucketName = process.env.S3_BUCKET;
    console.log(`Bucket:${bucketName}`);
    if(!bucketName || bucketName.trim() === ''){
        notifyCodeDeploy(
            event.DeploymentId,
            event.LifecycleEventHookExecutionId,
            'Failed');
        return 'Failed';
    }

    const baseBucketPath = process.env.S3_BUCKET_PATH; // time/1.1.1.1/Development/api-tests/
    console.log(`Bucket base path:${baseBucketPath}`);
    if(!baseBucketPath || baseBucketPath.trim() === ''){
        notifyCodeDeploy(
            event.DeploymentId,
            event.LifecycleEventHookExecutionId,
            'Failed');
        return 'Failed';
    }

    const testPath = baseBucketPath + '/' + 'tests';
    console.log(`Bucket test folder path:${testPath}`);

    const resultsPath = baseBucketPath + '/' + 'results';
    console.log(`Bucket results folder path:${resultsPath}`);

    const resultsFile = 'results.xml';
    console.log(`Results file:${resultsFile}`);
    const resultsFilePath = `/tmp/${resultsFile}`;

    const collectionFile = process.env.POSTMAN_COLLECTION_FILE;
    console.log(`Collection file:${collectionFile}`);
    if(!collectionFile || collectionFile.trim() === ''){
        notifyCodeDeploy(
            event.DeploymentId,
            event.LifecycleEventHookExecutionId,
            'Failed');
        return 'Failed';
    }
    const collectionFilePath = await downloadFile(bucketName, baseBucketPath, collectionFile);
    console.log(`Collection file path:${collectionFilePath}`);

    const environmentFile = process.env.POSTMAN_ENVIRONMENT_FILE;
    console.log(`Environment file:${environmentFile}`);
    if(!environmentFile || environmentFile.trim() === ''){
        notifyCodeDeploy(
            event.DeploymentId,
            event.LifecycleEventHookExecutionId,
            'Failed');
        return 'Failed';
    }
    const environmentFilePath = await downloadFile(bucketName, baseBucketPath, environmentFile);
    console.log(`Environment file path:${environmentFilePath}`);

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

    return new Promise(
        function(resolve, reject) {
            newman.run(
                {
                    collection: collectionFilePath,
                    delayRequest: 10000,
                    envVar: variables,
                    environment: environmentFilePath,
                    reporters: 'junitfull',
                    reporter: {
                        junitfull: {
                            export: resultsFilePath,
                        },
                    },
                },
                (newmanError, newmanData) => {
                    if (bucketName) {
                        const s3 = new aws.S3();
                        const testResultsData = fs.readFileSync(resultsFilePath, 'utf8');
                        s3.upload(
                            {
                                ContentType: "application/xml",
                                Bucket: bucketName,
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
                                    resolve,
                                    reject);
                            }
                        );
                    }
                }
            );
        }
    );
}
