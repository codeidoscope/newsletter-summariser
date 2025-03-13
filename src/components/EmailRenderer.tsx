import React from 'react';
import DOMPurify from 'dompurify';

interface EmailRendererProps {
  htmlContent?: string;
  textContent?: string;
  className?: string;
}

/**
 * A component that safely renders email content, preferring HTML when available
 * and falling back to formatted plain text.
 */
const EmailRenderer: React.FC<EmailRendererProps> = ({ 
  htmlContent, 
  textContent, 
  className = '' 
}) => {
  // If we have HTML content, sanitize it and render it
  if (htmlContent) {
    // Sanitize the HTML to prevent XSS attacks
    const sanitizedHtml = DOMPurify.sanitize(htmlContent, {
      // Allow these tags and attributes that are common in emails
      ALLOWED_TAGS: [
        'a', 'b', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'i', 'img', 'li', 'ol', 'p', 'span', 'strong', 'table',
        'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'style', 'class', 'target',
        'rel', 'width', 'height', 'border', 'cellpadding', 'cellspacing'
      ],
      // Add target="_blank" and rel="noopener noreferrer" to all links for security
      ADD_ATTR: ['target', 'rel'],
      // Fix URLs
      ADD_URI_SAFE_ATTR: ['src', 'href']
    });

    // Apply target="_blank" to all links that don't have it already
    // This is needed because DOMPurify might not add it to all links
    const parser = new DOMParser();
    const doc = parser.parseFromString(sanitizedHtml, 'text/html');
    const links = doc.querySelectorAll('a');
    links.forEach(link => {
      if (!link.getAttribute('target')) {
        link.setAttribute('target', '_blank');
      }
      if (!link.getAttribute('rel')) {
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });

    // Get the modified HTML
    const modifiedHtml = doc.body.innerHTML;

    return (
      <div 
        className={`email-renderer ${className}`}
        dangerouslySetInnerHTML={{ __html: modifiedHtml }}
      />
    );
  }

  // If we only have plain text, format it to be more readable
  if (textContent) {
    // Format plain text:
    // 1. Replace URLs with clickable links
    // 2. Preserve line breaks
    // 3. Make spacing more consistent
    const formattedText = formatPlainTextEmail(textContent);

    return (
      <div 
        className={`email-renderer plain-text ${className}`}
        dangerouslySetInnerHTML={{ __html: formattedText }}
      />
    );
  }

  // If we have neither HTML nor text content
  return (
    <div className={`email-renderer empty ${className}`}>
      <p className="text-gray-500">Email content not available</p>
    </div>
  );
};

/**
 * Format plain text email content to be more readable
 */
function formatPlainTextEmail(text: string): string {
  // Step 1: Escape HTML to prevent XSS
  let formattedText = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

  // Step 2: Convert URLs to clickable links
  // URL regex pattern - this covers most common URL formats
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  formattedText = formattedText.replace(urlRegex, (url) => {
    // Truncate displayed URL if it's too long
    const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
    return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline">${displayUrl}</a>`;
  });

  // Step 3: Convert email addresses to mailto links
  const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
  formattedText = formattedText.replace(emailRegex, (email) => {
    return `<a href="mailto:${email}" class="text-blue-500 hover:underline">${email}</a>`;
  });

  // Step 4: Preserve line breaks
  formattedText = formattedText.replace(/\n/g, '<br />');

  // Step 5: Add more spacing between paragraphs (double line breaks)
  formattedText = formattedText.replace(/<br \/><br \/>/g, '</p><p>');
  formattedText = `<p>${formattedText}</p>`;

  // Step 6: Clean up excessive line breaks
  formattedText = formattedText.replace(/<br \/><br \/><br \/>/g, '<br /><br />');

  return formattedText;
}

export default EmailRenderer;