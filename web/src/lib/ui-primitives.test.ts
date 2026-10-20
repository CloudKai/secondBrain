import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Badge,Button,ButtonLink,Callout,Card,EmptyState,ProgressBar,TabPanel,Tabs,ThemeToggle,panelId,tabId} from '../components/ui';

const noMasteryClaims=/mastered|understood/i;

test('focus callout shows its label text with the focus modifier and no mastery claim',()=>{
 const html=renderToStaticMarkup(createElement(Callout,{variant:'focus',title:'Continue learning'},'Lesson 2: Similarity is not support'));
 assert.match(html,/Continue learning/);
 assert.match(html,/ui-callout--focus/);
 assert.match(html,/aria-hidden="true"/);
 assert.doesNotMatch(html,noMasteryClaims);
});

test('icon-only button keeps its accessible name',()=>{
 const html=renderToStaticMarkup(createElement(Button,{iconOnly:true,'aria-label':'Close panel'},'x'));
 assert.match(html,/aria-label="Close panel"/);
 assert.match(html,/ui-button--icon/);
 assert.match(html,/type="button"/);
 assert.doesNotMatch(html,noMasteryClaims);
});

test('loading button is disabled and busy but keeps its label',()=>{
 const html=renderToStaticMarkup(createElement(Button,{loading:true,children:'Save note'}));
 assert.match(html,/aria-busy="true"/);
 assert.match(html,/disabled=""/);
 assert.match(html,/Save note/);
});

test('button link renders an anchor for hash navigation',()=>{
 const html=renderToStaticMarkup(createElement(ButtonLink,{href:'#topics',variant:'primary',children:'Browse topics'}));
 assert.match(html,/<a [^>]*href="#topics"/);
 assert.match(html,/ui-button--primary/);
});

test('tabs mark exactly one selected tab and tie it to its panel',()=>{
 const items=[{id:'one',label:'One'},{id:'two',label:'Two'},{id:'three',label:'Three',disabled:true}];
 const html=renderToStaticMarkup(createElement('div',null,
  createElement(Tabs,{label:'Sections',items,value:'two',onValueChange:()=>{},idPrefix:'demo'}),
  createElement(TabPanel,{idPrefix:'demo',value:'two',id:'two'},'Second panel'),
  createElement(TabPanel,{idPrefix:'demo',value:'two',id:'one'},'First panel')));
 assert.equal((html.match(/aria-selected="true"/g)??[]).length,1);
 assert.match(html,/role="tablist"/);
 assert.ok(html.includes(`aria-controls="${panelId('demo','two')}"`));
 assert.ok(html.includes(`id="${tabId('demo','two')}"`));
 assert.ok(html.includes(`aria-labelledby="${tabId('demo','two')}"`));
 assert.match(html,/tabindex="0"/);
 assert.match(html,/hidden=""/);
});

test('progress bar exposes its value and a position phrase',()=>{
 const html=renderToStaticMarkup(createElement(ProgressBar,{value:2,max:4,label:'Lesson position',valueText:'Lesson 2 of 4'}));
 assert.match(html,/role="progressbar"/);
 assert.match(html,/aria-valuenow="2"/);
 assert.match(html,/aria-valuemax="4"/);
 assert.match(html,/aria-valuetext="Lesson 2 of 4"/);
 assert.doesNotMatch(html,noMasteryClaims);
});

test('empty state renders its title and actions',()=>{
 const html=renderToStaticMarkup(createElement(EmptyState,{title:'Nothing saved yet',description:'Add a source note to begin.',actions:createElement(Button,null,'Add a source')}));
 assert.match(html,/<h2[^>]*>Nothing saved yet<\/h2>/);
 assert.match(html,/Add a source/);
 assert.doesNotMatch(html,noMasteryClaims);
});

test('theme toggle is a labelled group with one pressed option',()=>{
 const html=renderToStaticMarkup(createElement(ThemeToggle,{value:'dark',onChange:()=>{}}));
 assert.match(html,/role="group"/);
 assert.match(html,/aria-label="Appearance"/);
 assert.equal((html.match(/aria-pressed="true"/g)??[]).length,1);
 assert.match(html,/System/);assert.match(html,/Light/);assert.match(html,/Dark/);
});

test('card and badge render their content',()=>{
 const card=renderToStaticMarkup(createElement(Card,{as:'section',tone:'raised'},'Body'));
 assert.match(card,/<section class="ui-card ui-card--raised ui-card--pad-md"/);
 const badge=renderToStaticMarkup(createElement(Badge,{tone:'success',children:'Saved'}));
 assert.match(badge,/ui-badge--success/);
 assert.match(badge,/Saved/);
});
