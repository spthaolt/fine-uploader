/* globals describe, beforeEach, $fixture, qq, assert, it, qqtest, helpme, purl */
if (qqtest.canDownloadFileAsBlob) {
    describe("chunked S3 upload tests", function() {
        "use strict";

        var fileTestHelper = helpme.setupFileTests(),
            testS3Endpoint = "https://mytestbucket.s3.amazonaws.com",
            testBucketName = "mytestbucket",
            testSignatureEndoint = "/signature",
            testAccessKey = "testAccessKey",
            expectedFileSize = 3266,
            expectedChunks = 2,
            chunkSize = Math.round(expectedFileSize / expectedChunks),
            typicalRequestOption = {
                accessKey: testAccessKey,
                endpoint: testS3Endpoint
            },
            typicalSignatureOption = {
                endpoint: testSignatureEndoint
            },
            typicalChunkingOption = {
                enabled: true,
                partSize: chunkSize
            },
            startTypicalTest = function(uploader, callback) {
                qqtest.downloadFileAsBlob("up.jpg", "image/jpeg").then(function (blob) {
                    var initiateSignatureRequest, uploadRequest, initiateToSign;

                    fileTestHelper.mockXhr();
                    uploader.addBlobs({name: "test.jpg", blob: blob});

                    assert.equal(fileTestHelper.getRequests().length, 2, "Wrong # of requests");

                    uploadRequest = fileTestHelper.getRequests()[0];
                    initiateSignatureRequest = fileTestHelper.getRequests()[1];
                    initiateToSign = JSON.parse(initiateSignatureRequest.requestBody);

                    callback(initiateSignatureRequest, initiateToSign, uploadRequest);
                });
            };

        it("test most basic chunked upload", function(done) {
            assert.expect(57, done);

            var uploader = new qq.s3.FineUploaderBasic({
                    request: typicalRequestOption,
                    signature: typicalSignatureOption,
                    chunking: typicalChunkingOption
                }
            );

            startTypicalTest(uploader, function(initiateSignatureRequest, initiateToSign, uploadPartRequest) {
                var initiateRequest,
                    uploadPartSignatureRequest1,
                    uploadPartSignatureRequest2,
                    uploadPartToSign1,
                    uploadPartToSign2,
                    uploadCompleteSignatureRequest,
                    uploadCompleteToSign,
                    multipartCompleteRequest;

                // signature request for initiate multipart upload
                assert.equal(initiateSignatureRequest.url, testSignatureEndoint);
                assert.equal(initiateSignatureRequest.method, "POST");
                assert.equal(initiateSignatureRequest.requestHeaders["Content-Type"].indexOf("application/json;"), 0);
                assert.ok(initiateToSign.headers);
                assert.equal(initiateToSign.headers.indexOf("POST"), 0);
                assert.ok(initiateToSign.headers.indexOf("image/jpeg") > 0);
                assert.ok(initiateToSign.headers.indexOf("x-amz-acl:private") > 0);
                assert.ok(initiateToSign.headers.indexOf("x-amz-date:") > 0);
                assert.ok(initiateToSign.headers.indexOf("x-amz-meta-qqfilename:" + uploader.getName(0)) > 0);
                assert.ok(initiateToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploads") > 0);
                initiateSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // initiate multipart upload request
                assert.equal(fileTestHelper.getRequests().length, 3);
                initiateRequest = fileTestHelper.getRequests()[2];
                assert.equal(initiateRequest.method, "POST");
                assert.equal(initiateRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploads");
                assert.equal(initiateRequest.requestHeaders["x-amz-meta-qqfilename"], uploader.getName(0));
                assert.equal(initiateRequest.requestHeaders["x-amz-acl"], "private");
                assert.ok(initiateRequest.requestHeaders["x-amz-date"]);
                assert.equal(initiateRequest.requestHeaders.Authorization, "AWS " + testAccessKey + ":thesignature");
                initiateRequest.respond(200, null, "<UploadId>123</UploadId>");

                // signature request for upload part 1
                assert.equal(fileTestHelper.getRequests().length, 4);
                uploadPartSignatureRequest1 = fileTestHelper.getRequests()[3];
                assert.equal(uploadPartSignatureRequest1.method, "POST");
                assert.equal(uploadPartSignatureRequest1.url, testSignatureEndoint);
                assert.equal(uploadPartSignatureRequest1.requestHeaders["Content-Type"].indexOf("application/json;"), 0);
                uploadPartToSign1 = JSON.parse(uploadPartSignatureRequest1.requestBody);
                assert.ok(uploadPartToSign1.headers);
                assert.equal(uploadPartToSign1.headers.indexOf("PUT"), 0);
                assert.ok(uploadPartToSign1.headers.indexOf("x-amz-date:") > 0);
                assert.ok(uploadPartToSign1.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123") > 0);
                uploadPartSignatureRequest1.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // upload part 1 request
                assert.equal(uploadPartRequest.method, "PUT");
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123");
                assert.ok(uploadPartRequest.requestHeaders["x-amz-date"]);
                assert.equal(uploadPartRequest.requestHeaders.Authorization, "AWS " + testAccessKey + ":thesignature");
                uploadPartRequest.respond(200, {ETag: "etag1"}, null);

                // signature request for upload part 2
                assert.equal(fileTestHelper.getRequests().length, 5);
                uploadPartSignatureRequest2 = fileTestHelper.getRequests()[4];
                assert.equal(uploadPartSignatureRequest2.method, "POST");
                assert.equal(uploadPartSignatureRequest2.url, testSignatureEndoint);
                assert.equal(uploadPartSignatureRequest2.requestHeaders["Content-Type"].indexOf("application/json;"), 0);
                uploadPartToSign2 = JSON.parse(uploadPartSignatureRequest2.requestBody);
                assert.ok(uploadPartToSign2.headers);
                assert.equal(uploadPartToSign2.headers.indexOf("PUT"), 0);
                assert.ok(uploadPartToSign2.headers.indexOf("x-amz-date:") > 0);
                assert.ok(uploadPartToSign2.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123") > 0);
                uploadPartSignatureRequest2.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // upload part 2 request
                assert.equal(uploadPartRequest.method, "PUT");
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123");
                assert.ok(uploadPartRequest.requestHeaders["x-amz-date"]);
                assert.equal(uploadPartRequest.requestHeaders.Authorization, "AWS " + testAccessKey + ":thesignature");
                uploadPartRequest.respond(200, {ETag: "etag2"}, null);

                // signature request for multipart complete
                assert.equal(fileTestHelper.getRequests().length, 6);
                uploadCompleteSignatureRequest = fileTestHelper.getRequests()[5];
                assert.equal(uploadCompleteSignatureRequest.method, "POST");
                assert.equal(uploadCompleteSignatureRequest.url, testSignatureEndoint);
                assert.equal(uploadCompleteSignatureRequest.requestHeaders["Content-Type"].indexOf("application/json;"), 0);
                uploadCompleteToSign = JSON.parse(uploadCompleteSignatureRequest.requestBody);
                assert.ok(uploadCompleteToSign.headers);
                assert.equal(uploadCompleteToSign.headers.indexOf("POST"), 0);
                assert.ok(uploadCompleteToSign.headers.indexOf("x-amz-date:") > 0);
                assert.ok(uploadCompleteToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploadId=123") > 0);
                uploadCompleteSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // multipart complete request
                assert.equal(fileTestHelper.getRequests().length, 7);
                multipartCompleteRequest = fileTestHelper.getRequests()[6];
                assert.equal(multipartCompleteRequest.method, "POST");
                assert.equal(multipartCompleteRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploadId=123");
                assert.ok(multipartCompleteRequest.requestHeaders["x-amz-date"]);
                assert.equal(multipartCompleteRequest.requestHeaders.Authorization, "AWS " + testAccessKey + ":thesignature");
                assert.equal(multipartCompleteRequest.requestBody, "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>etag1</ETag></Part><Part><PartNumber>2</PartNumber><ETag>etag2</ETag></Part></CompleteMultipartUpload>");
                multipartCompleteRequest.respond(200, null, "<CompleteMultipartUploadResult><Bucket>" + testBucketName + "</Bucket><Key>" + uploader.getKey(0) + "</Key></CompleteMultipartUploadResult>");

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_SUCCESSFUL);
            });
        });

        it("test failures at every step of a chunked upload", function(done) {
            assert.expect(78, done);

            var uploader = new qq.s3.FineUploaderBasic({
                    debug: true,
                    request: typicalRequestOption,
                    signature: typicalSignatureOption,
                    chunking: typicalChunkingOption
                }
            );

            startTypicalTest(uploader, function(initiateSignatureRequest, initiateToSign, uploadPartRequest) {
                var initiateRequest,
                    uploadPartSignatureRequest1,
                    uploadPartSignatureRequest2,
                    uploadPartToSign1,
                    uploadPartToSign2,
                    uploadCompleteSignatureRequest,
                    uploadCompleteToSign,
                    multipartCompleteRequest;

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // failing signature request for initiate multipart upload
                assert.equal(initiateSignatureRequest.url, testSignatureEndoint);
                initiateSignatureRequest.respond(200, null, JSON.stringify({invalid: true}));
                assert.equal(fileTestHelper.getRequests().length, 2);

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                uploader.retry(0);
                assert.equal(fileTestHelper.getRequests().length, 4);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful initiate signature request
                initiateSignatureRequest = fileTestHelper.getRequests()[3];
                assert.equal(initiateSignatureRequest.url, testSignatureEndoint);
                assert.ok(initiateToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploads") > 0);
                initiateSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // failing initiate multipart upload request
                assert.equal(fileTestHelper.getRequests().length, 5);
                initiateRequest = fileTestHelper.getRequests()[4];
                assert.equal(initiateRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploads");
                initiateRequest.respond(200, null, "");

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 5);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);


                // successful initiate signature request
                assert.equal(fileTestHelper.getRequests().length, 7);
                initiateSignatureRequest = fileTestHelper.getRequests()[6];
                assert.equal(initiateSignatureRequest.url, testSignatureEndoint);
                assert.ok(initiateToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploads") > 0);
                initiateSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // successful initiate multipart upload request
                assert.equal(fileTestHelper.getRequests().length, 8);
                initiateRequest = fileTestHelper.getRequests()[7];
                assert.equal(initiateRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploads");
                initiateRequest.respond(200, null, "<UploadId>123</UploadId>");

                // failed signature request for upload part 1
                assert.equal(fileTestHelper.getRequests().length, 9);
                uploadPartSignatureRequest1 = fileTestHelper.getRequests()[8];
                assert.equal(uploadPartSignatureRequest1.url, testSignatureEndoint);
                uploadPartToSign1 = JSON.parse(uploadPartSignatureRequest1.requestBody);
                assert.ok(uploadPartToSign1.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123") > 0);
                uploadPartSignatureRequest1.respond(200, null, JSON.stringify({invalid: true}));

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 9);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for upload part 1
                assert.equal(fileTestHelper.getRequests().length, 11);
                uploadPartSignatureRequest1 = fileTestHelper.getRequests()[10];
                assert.equal(uploadPartSignatureRequest1.url, testSignatureEndoint);
                uploadPartToSign1 = JSON.parse(uploadPartSignatureRequest1.requestBody);
                assert.ok(uploadPartToSign1.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123") > 0);
                uploadPartSignatureRequest1.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // failing upload part 1 request
                assert.equal(fileTestHelper.getRequests().length, 11);
                uploadPartRequest = fileTestHelper.getRequests()[9];
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123");
                uploadPartRequest.respond(404, {ETag: "etag1"}, null);

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 11);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for upload part 1
                assert.equal(fileTestHelper.getRequests().length, 13);
                uploadPartSignatureRequest1 = fileTestHelper.getRequests()[12];
                assert.equal(uploadPartSignatureRequest1.url, testSignatureEndoint);
                uploadPartToSign1 = JSON.parse(uploadPartSignatureRequest1.requestBody);
                assert.ok(uploadPartToSign1.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123") > 0);
                uploadPartSignatureRequest1.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // successful upload part 1 request
                assert.equal(fileTestHelper.getRequests().length, 13);
                uploadPartRequest = fileTestHelper.getRequests()[11];
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=1&uploadId=123");
                uploadPartRequest.respond(200, {ETag: "etag1_a"}, null);

                // failing signature request for upload part 2
                assert.equal(fileTestHelper.getRequests().length, 14);
                uploadPartSignatureRequest2 = fileTestHelper.getRequests()[13];
                assert.equal(uploadPartSignatureRequest2.url, testSignatureEndoint);
                uploadPartToSign2 = JSON.parse(uploadPartSignatureRequest2.requestBody);
                assert.ok(uploadPartToSign2.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123") > 0);
                uploadPartSignatureRequest2.respond(404, null, JSON.stringify({signature: "thesignature"}));

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 14);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for upload part 2
                assert.equal(fileTestHelper.getRequests().length, 16);
                uploadPartSignatureRequest2 = fileTestHelper.getRequests()[15];
                assert.equal(uploadPartSignatureRequest2.url, testSignatureEndoint);
                uploadPartToSign2 = JSON.parse(uploadPartSignatureRequest2.requestBody);
                assert.ok(uploadPartToSign2.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123") > 0);
                uploadPartSignatureRequest2.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // failing upload part 2 request
                uploadPartRequest = fileTestHelper.getRequests()[14];
                assert.equal(fileTestHelper.getRequests().length, 16);
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123");
                uploadPartRequest.respond(404, {ETag: "etag2"}, null);

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 16);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for upload part 2
                assert.equal(fileTestHelper.getRequests().length, 18);
                uploadPartSignatureRequest2 = fileTestHelper.getRequests()[17];
                assert.equal(uploadPartSignatureRequest2.url, testSignatureEndoint);
                uploadPartToSign2 = JSON.parse(uploadPartSignatureRequest2.requestBody);
                assert.ok(uploadPartToSign2.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123") > 0);
                uploadPartSignatureRequest2.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // successful upload part 2 request
                assert.equal(fileTestHelper.getRequests().length, 18);
                uploadPartRequest = fileTestHelper.getRequests()[16];
                assert.equal(uploadPartRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?partNumber=2&uploadId=123");
                uploadPartRequest.respond(200, {ETag: "etag2_a"}, null);

                // failing signature request for multipart complete
                assert.equal(fileTestHelper.getRequests().length, 19);
                uploadCompleteSignatureRequest = fileTestHelper.getRequests()[18];
                assert.equal(uploadCompleteSignatureRequest.url, testSignatureEndoint);
                uploadCompleteToSign = JSON.parse(uploadCompleteSignatureRequest.requestBody);
                assert.ok(uploadCompleteToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploadId=123") > 0);
                uploadCompleteSignatureRequest.respond(400, null, JSON.stringify({signature: "thesignature"}));

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 19);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for multipart complete
                assert.equal(fileTestHelper.getRequests().length, 21);
                uploadCompleteSignatureRequest = fileTestHelper.getRequests()[20];
                assert.equal(uploadCompleteSignatureRequest.url, testSignatureEndoint);
                uploadCompleteToSign = JSON.parse(uploadCompleteSignatureRequest.requestBody);
                assert.ok(uploadCompleteToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploadId=123") > 0);
                uploadCompleteSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // failing multipart complete request
                assert.equal(fileTestHelper.getRequests().length, 22);
                multipartCompleteRequest = fileTestHelper.getRequests()[21];
                assert.equal(multipartCompleteRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploadId=123");
                assert.equal(multipartCompleteRequest.requestBody, "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>etag1_a</ETag></Part><Part><PartNumber>2</PartNumber><ETag>etag2_a</ETag></Part></CompleteMultipartUpload>");
                multipartCompleteRequest.respond(200, null, "<CompleteMultipartUploadResult><Key>" + uploader.getKey(0) + "</Key></CompleteMultipartUploadResult>");

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_FAILED);
                assert.equal(fileTestHelper.getRequests().length, 22);
                uploader.retry(0);
                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOADING);

                // successful signature request for multipart complete
                assert.equal(fileTestHelper.getRequests().length, 24);
                uploadCompleteSignatureRequest = fileTestHelper.getRequests()[23];
                assert.equal(uploadCompleteSignatureRequest.url, testSignatureEndoint);
                uploadCompleteToSign = JSON.parse(uploadCompleteSignatureRequest.requestBody);
                assert.ok(uploadCompleteToSign.headers.indexOf("/" + testBucketName + "/" + uploader.getKey(0) + "?uploadId=123") > 0);
                uploadCompleteSignatureRequest.respond(200, null, JSON.stringify({signature: "thesignature"}));

                // successful multipart complete request
                assert.equal(fileTestHelper.getRequests().length, 25);
                multipartCompleteRequest = fileTestHelper.getRequests()[24];
                assert.equal(multipartCompleteRequest.url, testS3Endpoint + "/" + uploader.getKey(0) + "?uploadId=123");
                assert.equal(multipartCompleteRequest.requestBody, "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>etag1_a</ETag></Part><Part><PartNumber>2</PartNumber><ETag>etag2_a</ETag></Part></CompleteMultipartUpload>");
                multipartCompleteRequest.respond(200, null, "<CompleteMultipartUploadResult><Bucket>" + testBucketName + "</Bucket><Key>" + uploader.getKey(0) + "</Key></CompleteMultipartUploadResult>");

                assert.equal(uploader.getUploads()[0].status, qq.status.UPLOAD_SUCCESSFUL);
            });
        });
    });
}