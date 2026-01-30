const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");

exports.sendToWhisper = async (filePath) => {
  const form = new FormData();
  form.append("file", fs.createReadStream(filePath));

  const response = await axios.post(
    "http://localhost:5001/stt",
    form,
    {
      headers: form.getHeaders(),
    }
  );

  return response.data.text;
};
