var fileSelected = null;
var token = "<API_publish_key";
var domain = '<domain_api>';
var getExtFile = (filename)=>{
  if(!filename)
    return '.mp4';
  return '.'+filename.split('.').pop();
};

var changeFile = ($event)=>{
  console.log('$event', $event.target.files);
  if($event.target.files && $event.target.files[0]){
    var tmp = $event.target.files[0];
    fileSelected = {
      name : tmp.name,
      body : tmp,
      size : tmp.size,
      inputType : 's3-uiza', //require
      url : ""
    };
  }
  console.log('fileSelected',fileSelected);
};

var createEntity = ()=>{
  return new Promise((resolve, reject)=>{
    var tmpFile = Object.assign({}, fileSelected);
    delete tmpFile.body;
    console.log('tmpFile',tmpFile);
    $.ajax({
      type: "POST",
      beforeSend: function(request) {
        request.setRequestHeader("Authorization", token);
      },
      url: domain + "api/public/v3/media/entity",
      data: tmpFile,
      success: function(data) {
        return resolve(data);
      },
      error: function(data) {
        return reject(data);
      }
    });
  });
};

var getConfigAws = ()=>{
  let url = domain + 'api/public/v3/admin/app/config/aws';
  return new Promise((resolve, reject)=>{
    $.ajax({
      type: "GET",
      beforeSend: function(request) {
        request.setRequestHeader("Authorization", token);
      },
      url: url,
      success: function(data) {
        resolve(data);
      },
      error: function(data) {
        reject(data);
      }
    });
  });
};

var uploadAWS = (configAWS, idCreated)=>{
  let config = {
    accessKeyId: configAWS.temp_access_id,
    secretAccessKey: configAWS.temp_access_secret,
    region: configAWS.region_name,
    sessionToken : configAWS.temp_session_token
  };
  AWS.config.update(config);
  var s3 = (new (AWS.S3)());

  return new Promise((resolve, reject)=>{
    let bucketName = configAWS.bucket_name;
    let bucketInfo = bucketName.split('/');

    let paramsUploadAws = {
      Key:        bucketInfo[1] + '/'+ bucketInfo[2] + '/s3+uiza+'+idCreated+getExtFile(fileSelected.name),
      Bucket:     bucketInfo[0],
      Body:       fileSelected.body, //file stream
    };
    console.log('paramsUploadAws',paramsUploadAws);
    s3.upload(paramsUploadAws, (error, result) => {
      if(error) {
        console.error(error);
        reject(error);
        return;
      }
      console.log('update to s3 DONE', result);
      resolve(result);
    });
  });
};

var updateEntity = (idCreated, process='error', progress = 0)=>{
  return new Promise((resolve, reject)=>{
    $.ajax({
      type: "PUT",
      beforeSend: function(request) {
        request.setRequestHeader("Authorization", token);
      },
      url: domain + "api/public/v3/media/entity",
      data: {
        id: idCreated,
        "uploadDetail": { "process": process, "progress": progress }
      },
      success: function(data) {
        return resolve(data);
      },
      error: function(data) {
        return reject(data);
      }
    });
  });
};

var getEntity = (id)=>{
  return new Promise((resolve, reject)=>{
    $.ajax({
      type: "GET",
      beforeSend: function(request) {
        request.setRequestHeader("Authorization", token);
      },
      url: domain + "api/public/v3/media/entity?id="+id,
      success: function(data) {
        return resolve(data);
      },
      error: function(data) {
        return reject(data);
      }
    });
  });
};

var submitUpload = async ()=>{
  if(!fileSelected)
    return alert('File select empty');
  console.log('fileSelected',fileSelected);

  var idCreated = null;
  var configAWS = null;
  var dataAWS = null;

  //step 1 create entity
  try{
    dataCreated = await createEntity();
    if(dataCreated && dataCreated.data && dataCreated.data.id){
      idCreated = dataCreated.data.id;
    }
    console.log('idCreated', idCreated);
    if(!idCreated) return alert('create entity fail');
  }catch(error){
    console.error(error);
    return
  }

  //step 2 get config aws
  try{
    configAWS = await getConfigAws();
    if(configAWS && configAWS.data) configAWS = configAWS.data;
    console.log('configAWS',configAWS);
  }catch(error){
    console.error(error);
    return
  }

  //step 3 upload to aws
  try{
    dataAWS = await uploadAWS(configAWS, idCreated);
  }catch(error){
    console.error(error);
    updateEntity(idCreated, 'error', 50);
    return
  }

  //step 4 update entity
  if(dataAWS ){
    try{
      await updateEntity(idCreated, 'success', 100);
    }catch(error){
      console.error(error);
    }
  }
  var entityDetail = null;
  try{
    entityDetail = await getEntity(idCreated);
    console.log('entity detail',entityDetail);
  }catch(error){
    console.error(error);
  }

  //step 5 done
  console.log('ALL DONE');
};

$(document).ready(async ()=>{
  console.log('document ready');
});