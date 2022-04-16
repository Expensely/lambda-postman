FROM amazon/aws-lambda-nodejs:14 as lambda-postman
ARG BUILD_NUMBER=1.0.0-0
WORKDIR /var/task
COPY . ./
RUN npm ci
RUN npm run build
CMD [ "index.handler" ]