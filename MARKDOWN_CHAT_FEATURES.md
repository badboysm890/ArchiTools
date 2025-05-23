# Markdown Chat Features

## Overview

The chat system now supports full markdown formatting for all AI responses, making them more readable and visually appealing. Additionally, special handling for `<think>` tags allows users to view the AI's reasoning process.

## Supported Markdown Features

### 📝 Text Formatting
- **Bold text**: `**bold**` or `__bold__`
- *Italic text*: `*italic*` or `_italic_`
- ~~Strikethrough~~: `~~strikethrough~~`
- `Inline code`: `` `code` ``

### 🔗 Links
- Automatic link detection
- [Named links](https://example.com)
- External links open in new tabs
- Hover effects with underline animations

### 📋 Lists
- **Unordered lists**: Use `-`, `*`, or `+`
  - Nested lists supported
  - Automatic spacing
- **Ordered lists**: Use `1.`, `2.`, etc.
  1. First item
  2. Second item
  3. Third item

### 📊 Tables
Full GitHub Flavored Markdown (GFM) table support:

| Feature | Status | Notes |
|---------|--------|-------|
| Headers | ✅ | Styled with background |
| Borders | ✅ | Consistent theme colors |
| Alignment | ✅ | Left, center, right |
| Responsive | ✅ | Horizontal scroll on mobile |

### 💻 Code Blocks

#### Inline Code
Use backticks for `inline code` with proper styling.

#### Code Blocks with Syntax Highlighting
```javascript
// JavaScript example
function greet(name) {
  console.log(`Hello, ${name}!`);
}
```

```python
# Python example
def greet(name):
    print(f"Hello, {name}!")
```

```bash
# Bash example
echo "Hello, World!"
```

**Supported Languages**: JavaScript, Python, Bash, TypeScript, CSS, HTML, JSON, SQL, and many more.

### 📋 Quotes
> This is a blockquote
> 
> It can span multiple lines and includes
> proper styling with left border accent.

### 🔢 Headings
```markdown
# Heading 1
## Heading 2  
### Heading 3
```

### ➖ Horizontal Rules
Use `---` or `***` for horizontal dividers:

---

## Special Features

### 🤔 AI Thinking Process (`<think>` tags)

When AI responses contain `<think>` tags, the thinking content is automatically extracted and presented in a collapsible section:

```
<think>
Let me analyze this step by step:
1. First, I need to understand the problem
2. Then consider the possible solutions
3. Finally, provide the best recommendation
</think>

Here's my response based on careful analysis...
```

**How it appears:**
- Thinking content is hidden by default
- Click "Show AI thinking process" to expand
- Styled with special background and 🤔 emoji
- Helps users understand the AI's reasoning

### 🎨 Theme Integration
- All markdown elements respect the app's dark theme
- Custom syntax highlighting colors
- Consistent spacing and typography
- Responsive design for mobile devices

### 🔧 Technical Implementation

#### Components
- **MarkdownMessage.jsx**: Main component handling markdown rendering
- **MarkdownMessage.css**: Custom styling for markdown elements
- **ChatMessages.jsx**: Updated to use markdown rendering

#### Libraries Used
- `react-markdown`: Core markdown parsing
- `remark-gfm`: GitHub Flavored Markdown support
- `rehype-highlight`: Syntax highlighting
- `rehype-raw`: HTML support for custom elements

#### Processing Pipeline
1. **Content Parsing**: Extract `<think>` tags from message content
2. **Markdown Rendering**: Convert remaining content to HTML
3. **Syntax Highlighting**: Apply language-specific styling
4. **Theme Integration**: Apply custom CSS classes

## Usage Examples

### Basic Formatting
```markdown
Here's how to format text:

**Bold** and *italic* text looks great.
You can also use `code snippets` inline.

- Create lists easily
- With proper spacing
- And nested items
  - Like this one
```

### Code Examples
```markdown
Here's a function:

```javascript
function analyzeImage(canvas) {
  const context = canvas.getContext('2d');
  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  return processImageData(imageData);
}
```
```

### Tables and Data
```markdown
| Model | Accuracy | Speed |
|-------|----------|-------|
| Gemma 3 | 95% | Fast |
| Qwen VL | 92% | Medium |
| TinyLlama | 85% | Very Fast |
```

### Thinking Process Example
```markdown
<think>
The user is asking about image analysis. I should:
1. Explain the technical approach
2. Provide code examples
3. Mention performance considerations
</think>

For image analysis, you'll want to use canvas APIs...
```

## Benefits

### 📖 Improved Readability
- Structured content with proper headings
- Code blocks with syntax highlighting
- Tables for organized data presentation
- Visual hierarchy with typography

### 🔍 Better Understanding
- AI thinking process visibility
- Step-by-step explanations
- Code examples with context
- Technical documentation formatting

### 🎯 Enhanced User Experience
- Consistent styling with app theme
- Responsive design for all devices
- Smooth animations and transitions
- Intuitive collapsible sections

### 🛠️ Developer Benefits
- Easy to extend with new markdown features
- Modular component architecture
- Consistent styling system
- Debug-friendly structure

## Configuration

### Syntax Highlighting
The app uses a custom dark theme for code highlighting that matches the overall design. Colors are configured in `src/index.css`:

```css
.hljs-keyword { color: #ff79c6; }
.hljs-string { color: #f1fa8c; }
.hljs-number { color: #bd93f9; }
.hljs-comment { color: #6272a4; }
```

### Custom Components
Markdown rendering can be customized by modifying the `markdownComponents` object in `MarkdownMessage.jsx`:

```javascript
const markdownComponents = {
  // Custom code block rendering
  code({ node, inline, className, children, ...props }) {
    // Custom implementation
  },
  
  // Custom table rendering
  table({ children }) {
    // Custom implementation
  }
};
```

## Performance

- **Lightweight**: Only loads markdown processing for messages that need it
- **Efficient**: Uses React's built-in optimization for re-renders
- **Lazy**: Thinking content is only rendered when expanded
- **Responsive**: Optimized for both desktop and mobile

## Future Enhancements

Potential future additions:
- Math equation support (LaTeX)
- Mermaid diagram rendering
- Interactive code execution
- Markdown toolbar for user input
- Copy-to-clipboard for code blocks
- Collapsible sections for long responses 