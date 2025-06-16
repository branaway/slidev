# Streaming Markdown

Slidev supports streaming markdown rendering, which creates a typewriter effect where text appears progressively character by character. This feature is perfect for presentations that simulate AI/LLM responses or want to create engaging progressive text reveals.

## Usage

To enable streaming markdown on a slide, add the following to your slide's frontmatter:

```yaml
---
streamingMarkdown: true
streamingSpeed: 50
---
```

## Configuration

### `streamingMarkdown`

- **Type:** `boolean`
- **Default:** `false`

Enable streaming markdown rendering for the slide.

### `streamingSpeed`

- **Type:** `number`
- **Default:** `20`

Speed of streaming in milliseconds per character. Lower values make the text appear faster.

## Example

```md
---
streamingMarkdown: true
streamingSpeed: 50
---

# Streaming Markdown Demo

This text will appear character by character, creating a typewriter effect.

- List items also stream progressively
- Each character appears one by one
- HTML tags are handled smoothly

<div class="highlight">
  Even HTML content streams naturally!
</div>
```

## Features

- **Character-by-character streaming**: Text appears progressively, one character at a time
- **HTML tag handling**: HTML tags are treated as atomic units to prevent flickering
- **Blinking cursor**: A cursor appears at the end of the streaming text and disappears when complete
- **Configurable speed**: Adjust the streaming speed to match your presentation style
- **Markdown support**: Works with all markdown elements including lists, headers, and HTML

## Use Cases

- **AI/LLM Demonstrations**: Simulate chatbot or AI responses
- **Progressive Reveals**: Build suspense by revealing content gradually
- **Interactive Presentations**: Create engaging, dynamic content reveals
- **Educational Content**: Help audience follow along with complex explanations

## Technical Details

The streaming effect is implemented using the `StreamingMarkdown` component, which:

1. Processes the markdown content character by character
2. Treats HTML tags as atomic units to prevent visual artifacts
3. Uses markdown-it to render the progressive content
4. Shows a blinking cursor during streaming that disappears when complete

The feature transforms regular markdown content into streaming components automatically when `streamingMarkdown: true` is set in the frontmatter.
