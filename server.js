const express = require('express');
const bodyParser = require('body-parser');
const multer = require('multer');
const ejs = require('ejs');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer'); // ✅ use puppeteer (not puppeteer-core)

const app = express();

// Multer setup for profile image upload
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

    // Normalize optional fields
    const normalize = (field) =>
      Array.isArray(field) ? field.join(', ') : field || '';

    formData.skills = normalize(req.body.skills);
    formData.certifications = normalize(req.body.certifications);
    formData.languages = normalize(req.body.languages);
    formData.hobbies = normalize(req.body.hobbies);
    formData.education3_duration = formData.education3_duration || '';
    formData.education3_grade = formData.education3_grade || '';

    // Convert uploaded image to base64
    if (req.file) {
      const imagePath = path.join(__dirname, 'uploads', req.file.filename);
      const imageBuffer = fs.readFileSync(imagePath);
      const mimeType = req.file.mimetype;
      formData.profileImage = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } else {
      formData.profileImage = null;
    }

    // Render EJS HTML
    const html = await ejs.renderFile(
      path.join(__dirname, 'views', 'resume.ejs'),
      formData,
      { async: true }
    );

    // Launch Puppeteer and generate PDF
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', bottom: '10mm', left: '15mm', right: '15mm' }
    });

    await browser.close();

    // Return PDF as download
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename=resume.pdf',
    });
    res.send(pdfBuffer);

    // Clean up uploaded file
    if (req.file) {
      fs.promises.unlink(path.join(__dirname, 'uploads', req.file.filename)).catch(console.error);
    }

  } catch (error) {
    console.error('Error generating PDF:', error);
    res.status(500).send('An error occurred while generating your resume.');
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
