const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer-core');

const app = express();

// Configure Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Routes
app.get('/', (req, res) => {
  res.render('form');
});

app.post('/generate', upload.single('profile'), async (req, res) => {
  try {
    const formData = { ...req.body };

    // Normalize fields
    formData.skills = Array.isArray(req.body.skills) ? req.body.skills.join(', ') : req.body.skills || '';
    formData.certifications = Array.isArray(req.body.certifications) ? req.body.certifications.join(', ') : req.body.certifications || '';
    formData.languages = Array.isArray(req.body.languages) ? req.body.languages.join(', ') : req.body.languages || '';
    formData.hobbies = Array.isArray(req.body.hobbies) ? req.body.hobbies.join(', ') : req.body.hobbies || '';
    formData.education3_duration = formData.education3_duration || '';
    formData.education3_grade = formData.education3_grade || '';

    // Handle image (convert to base64)
    if (req.file) {
      const imagePath = path.join(__dirname, 'uploads', req.file.filename);
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = req.file.mimetype;
      const base64Image = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      formData.profileImage = base64Image;
    } else {
      formData.profileImage = null;
    }

    // Render EJS template
    const html = await ejs.renderFile(
      path.join(__dirname, 'views', 'resume.ejs'),
      formData,
      { settings: { views: path.join(__dirname, 'views') } }
    );

    // Generate PDF with Puppeteer
    const browser = await puppeteer.launch({
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', // adjust if needed
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '15mm',
        right: '15mm'
      }
    });

    await browser.close();

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=resume.pdf'
    });
    res.send(pdfBuffer);

    if (req.file) {
      fs.unlink(path.join(__dirname, 'uploads', req.file.filename), () => {});
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('An error occurred while generating your resume.');
  }
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
