function doPost(e) {
  try {
    // Parse the incoming JSON payload
    var params = JSON.parse(e.postData.contents);
    
    var to = params.to;
    var subject = params.subject;
    var htmlBody = params.htmlBody;
    
    // Check if required fields are present
    if (!to || !subject || !htmlBody) {
      return ContentService.createTextOutput(JSON.stringify({
        status: 'error',
        message: 'Missing required parameters: to, subject, htmlBody'
      })).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Search for an existing thread in the sender's account
    var threads = GmailApp.search('subject:"' + subject + '" to:' + to, 0, 1);
    
    if (threads.length > 0) {
      // Reply to the existing thread to force Gmail to group them!
      threads[0].replyAll('', {
        htmlBody: htmlBody,
        name: 'PC-V1 Portal'
      });
    } else {
      // Create a brand new thread
      GmailApp.sendEmail(to, subject, '', {
        htmlBody: htmlBody,
        name: 'PC-V1 Portal'
      });
    }
    
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Email sent successfully to ' + to
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
