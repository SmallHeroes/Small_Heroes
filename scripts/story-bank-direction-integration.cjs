function sentence(value) {
  const normalized = String(value).replace(/\s+/g, ' ').trim().replace(/[.]+$/u, '');
  return normalized ? `${normalized}.` : '';
}

function pageDirection(page) {
  const shot = page.shotType.replaceAll('_', ' ');
  const angle = page.cameraAngle.replaceAll('_', ' ');
  const parts = [
    sentence(`${shot} shot, ${angle} view, ${page.setting}`),
    sentence(page.mainAction),
    sentence(`Child ${page.childPresence}; companion ${page.companionPresence}`),
    page.supportingCharacters.length > 0
      ? sentence(`Supporting characters: ${page.supportingCharacters.join(', ')}`)
      : '',
    page.heroObject ? sentence(`Hero object: ${page.heroObject}`) : '',
    sentence(`Lighting: ${page.lighting}`),
    page.continuityAnchors.length > 0
      ? sentence(`Continuity: ${page.continuityAnchors.join('; ')}`)
      : '',
  ].filter(Boolean);
  const result = parts.join(' ');
  if (/\r|\n|[\u0590-\u05ff]|\{\{|\}\}/u.test(result) || result.length > 1600) {
    throw new Error('vnext_story_bank_image_direction_invalid');
  }
  return result;
}

function injectDirections(source, record) {
  if (/^imageDirection:/m.test(source)) {
    throw new Error('vnext_story_bank_source_already_directed');
  }
  let index = 0;
  const integrated = source.replace(
    /^--- Page (\d+) ---\s*$/gm,
    (marker, pageNumber) => {
      const page = record.pages[index];
      if (!page || page.pageNumber !== Number(pageNumber)) {
        throw new Error('vnext_story_bank_page_binding_invalid');
      }
      index += 1;
      return `${marker}\nimageDirection: ${pageDirection(page)}`;
    },
  );
  if (index !== record.pages.length) {
    throw new Error('vnext_story_bank_page_coverage_invalid');
  }
  const projected = integrated.replace(/^imageDirection:.*\r?\n/gm, '');
  if (Buffer.from(projected, 'utf8').compare(Buffer.from(source, 'utf8')) !== 0) {
    throw new Error('vnext_story_bank_source_projection_drift');
  }
  return integrated;
}

module.exports = { injectDirections, pageDirection };
