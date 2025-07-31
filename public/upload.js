
async function uploadFile() {
    const imageInput = document.getElementById('pdfInput');
    const file = imageInput.files[0];
    if (!file) {
        alert('Please select a file.');
        return;
    }

    const formData = new FormData();
    formData.append('pdf', file);

    try {
        const response = await axios.post('/api/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
        document.getElementById('result').innerText = JSON.stringify(response.data, null, 2);
    } catch (error) {
        console.error('Error uploading file:', error);
        document.getElementById('result').innerText = 'Error uploading file. Please check the console for details.';
    }
}

// Add event listener to the button
document.getElementById('uploadButton').addEventListener('click', uploadFile);
