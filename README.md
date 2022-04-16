# CodeDeploy Lambda Postman

## About
This container will run a postman collection with the specified environment file and load in any additional variables, upload the results to S3 and then report back to code deploy.

Test results are JUnit and will be uploaded to the specified bucket.

## Environment variables
| Name                        | Description                                                                                                      |
|-----------------------------|------------------------------------------------------------------------------------------------------------------|
| `S3_BUCKET`                 | S3 bucket to upload results to                                                                                   |
| `S3_BUCKET_PATH`            | Path to place the `POSTMAN_RESULTS_FILE` in S3                                                                   |
| `POSTMAN_COLLECTION_FILE`   | Postman collection to run                                                                                        |
| `POSTMAN_ENVIRONMENT_FILE`  | Postman environment variable file to use                                                                         |
| `POSTMAN_RESULTS_FILE`      | Results file name                                                                                                |
| `POSTMAN_VARIABLE_*`        | Environment variables to add. Prefix variable name with `POSTMAN_VARIABLE_` and they will be picked up and added |
