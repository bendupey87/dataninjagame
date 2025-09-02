# Data Ninja Game

**Data Ninja Game** is a browser-based coding puzzle platform for students.  
It features interactive Python challenges, secure score submission, and a modular frontend built with modern web technologies.

---

## Features

- **Interactive Missions:** Solve Python coding puzzles directly in the browser.
- **Code Editor:** Powered by [CodeMirror](https://codemirror.net/) with Python syntax highlighting.
- **Theme Support:** Light/dark mode with persistent user preference.
- **Secure Score Submission:** Scores and codes are sent to a Google Sheet via Apps Script, protected by a Cloudflare Worker proxy.
- **No Personal Data:** Only codes and scores are stored—no student names or emails.
- **Modular Codebase:** Clean separation of HTML, CSS, and JavaScript for easy maintenance and expansion.

---

## File Structure

```
dataninjagame/
│
├── assets/                  # Images and static assets
├── src/
│   ├── js/
│   │   ├── main.js          # Main app logic
│   │   └── theme.js         # Theme switching logic
│   └── css/
│       └── main.css         # Main stylesheet
├── public/
│   └── index.html           # Main game page
├── Code.gs                  # Google Apps Script backend
├── worker.js                # Cloudflare Worker proxy
├── answer_key.txt           # Instructor answer key
├── README.md                # Project documentation
```

---

## Getting Started

1. **Clone the repository:**
   ```
   git clone https://github.com/bendupey87/dataninjagame.git
   ```

2. **Open `index.html` in your browser** to play and test locally.

3. **Set up the backend:**
   - Deploy `Code.gs` as a Google Apps Script web app linked to your Google Sheet.
   - Configure `worker.js` in Cloudflare Workers to proxy and protect your Apps Script endpoint.

4. **Customize missions and answer key** as needed for your class.

---

## Technologies Used

- **HTML5, CSS3, JavaScript (ES6+)**
- **CodeMirror** for in-browser code editing
- **Pyodide** for running Python in the browser
- **Google Apps Script** for backend data storage
- **Cloudflare Worker** for secure API proxying

---

## Security & Privacy

- No personal information is collected or stored.
- Only codes and scores are submitted and saved.
- Backend endpoints are protected by origin checks and a shared secret for CLI/API access.

---

## Contributing

Pull requests and suggestions are welcome!  
Feel free to fork and adapt for your own classroom or coding challenges.

---

## License

MIT License (or specify your preferred license here).

---

**Questions or feedback?**  
Open an issue or contact [bendupey87](https://github.com/bendupey87)