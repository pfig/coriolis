import React from 'react';
import { findDOMNode } from 'react-dom';
import { Ships } from 'coriolis-data/dist';
import cn from 'classnames';
import Page from './Page';
import Router from '../Router';
import Persist from '../stores/Persist';
import Ship from '../shipyard/Ship';
import { toDetailedBuild } from '../shipyard/Serializer';
import { outfitURL } from '../utils/UrlGenerators';
import { FloppyDisk, Bin, Switch, Download, Reload, LinkIcon, ShoppingIcon } from '../components/SvgIcons';
import ShipSummaryTable from '../components/ShipSummaryTable';
import StandardSlotSection from '../components/StandardSlotSection';
import HardpointsSlotSection from '../components/HardpointsSlotSection';
import InternalSlotSection from '../components/InternalSlotSection';
import UtilitySlotSection from '../components/UtilitySlotSection';
import OffenceSummary from '../components/OffenceSummary';
import DefenceSummary from '../components/DefenceSummary';
import MovementSummary from '../components/MovementSummary';
import EngineProfile from '../components/EngineProfile';
import FSDProfile from '../components/FSDProfile';
import JumpRange from '../components/JumpRange';
import DamageDealt from '../components/DamageDealt';
import DamageReceived from '../components/DamageReceived';
import PowerManagement from '../components/PowerManagement';
import CostSection from '../components/CostSection';
import ModalExport from '../components/ModalExport';
import ModalPermalink from '../components/ModalPermalink';
import Slider from '../components/Slider';

/**
 * Document Title Generator
 * @param  {String} shipName  Ship Name
 * @param  {String} buildName Build Name
 * @return {String}           Document title
 */
function getTitle(shipName, buildName) {
  return buildName ? buildName : shipName;
}

/**
 * The Outfitting Page
 */
export default class OutfittingPage extends Page {

  /**
   * Constructor
   * @param  {Object} props   React Component properties
   * @param  {Object} context React Component context
   */
  constructor(props, context) {
    super(props, context);
    this.state = this._initState(context);
    this._keyDown = this._keyDown.bind(this);
    this._exportBuild = this._exportBuild.bind(this);
  }

  /**
   * [Re]Create initial state from context
   * @param  {context} context React component context
   * @return {Object}          New state object
   */
  _initState(context) {
    let params = context.route.params;
    let shipId = params.ship;
    let code = params.code;
    let buildName = params.bn;
    let data = Ships[shipId];   // Retrieve the basic ship properties, slots and defaults
    let savedCode = Persist.getBuild(shipId, buildName);

    if (!data) {
      return { error: { message: 'Ship not found: ' + shipId } };
    }

    let ship = new Ship(shipId, data.properties, data.slots);          // Create a new Ship instance

    if (code) {
      ship.buildFrom(code);  // Populate modules from serialized 'code' URL param
    } else {
      ship.buildWith(data.defaults);  // Populate with default components
    }

    this._getTitle = getTitle.bind(this, data.properties.name);

    return {
      error: null,
      title: this._getTitle(buildName),
      costTab: Persist.getCostTab() || 'costs',
      buildName,
      newBuildName: buildName,
      shipId,
      ship,
      code,
      savedCode
    };
  }

  /**
   * Handle build name change and update state
   * @param  {SyntheticEvent} event React Event
   */
  _buildNameChange(event) {
    let stateChanges = {
      newBuildName: event.target.value
    };

    if (Persist.hasBuild(this.state.shipId, stateChanges.newBuildName)) {
      stateChanges.savedCode = Persist.getBuild(this.state.shipId, stateChanges.newBuildName);
    } else {
      stateChanges.savedCode = null;
    }

    this.setState(stateChanges);
  }

  /**
   * Save the current build
   */
  _saveBuild() {
    let code = this.state.ship.toString();
    let { buildName, newBuildName, shipId } = this.state;

    if (buildName === newBuildName) {
      Persist.saveBuild(shipId, buildName, code);
      this._updateRoute(shipId, buildName, code);
    } else {
      Persist.saveBuild(shipId, newBuildName, code);
      this._updateRoute(shipId, newBuildName, code);
    }

    this.setState({ buildName: newBuildName, code, savedCode: code, title: this._getTitle(newBuildName) });
  }

  /**
   * Rename the current build
   */
  _renameBuild() {
    let { buildName, newBuildName, shipId, ship } = this.state;
    if (buildName != newBuildName && newBuildName.length) {
      let code = ship.toString();
      Persist.deleteBuild(shipId, buildName);
      Persist.saveBuild(shipId, newBuildName, code);
      this._updateRoute(shipId, newBuildName, code);
      this.setState({ buildName: newBuildName, code, savedCode: code });
    }
  }

  /**
   * Reload build from last save
   */
  _reloadBuild() {
    this.state.ship.buildFrom(this.state.savedCode);
    this._shipUpdated();
  }

  /**
   * Reset build to Stock/Factory defaults
   */
  _resetBuild() {
    this.state.ship.buildWith(Ships[this.state.shipId].defaults);
    this._shipUpdated();
  }

  /**
   * Delete the build
   */
  _deleteBuild() {
    Persist.deleteBuild(this.state.shipId, this.state.buildName);
    Router.go(outfitURL(this.state.shipId));
  }

  /**
   * Serialized and show the export modal
   */
  _exportBuild() {
    let translate = this.context.language.translate;
    let { buildName, ship } = this.state;
    this.context.showModal(<ModalExport
      title={(buildName || ship.name) + ' ' + translate('export')}
      description={translate('PHRASE_EXPORT_DESC')}
      data={toDetailedBuild(buildName, ship, ship.toString())}
    />);
  }

  /**
   * Trigger render on ship model change
   */
  _shipUpdated() {
    let { shipId, buildName, ship } = this.state;
    let code = ship.toString();

    this._updateRoute(shipId, buildName, code);
    this.setState({ code });
  }

  /**
   * Update the current route based on build
   * @param  {string} shipId    Ship Id
   * @param  {string} buildName Current build name
   * @param  {string} code      Serialized ship 'code'
   */
  _updateRoute(shipId, buildName, code) {
    Router.replace(outfitURL(shipId, code, buildName));
  }

  /**
   * Update dimenions from rendered DOM
   */
  _updateDimensions() {
    let elem = findDOMNode(this.refs.chartThird);

    if (elem) {
      this.setState({
        thirdChartWidth: findDOMNode(this.refs.chartThird).offsetWidth,
        halfChartWidth: findDOMNode(this.refs.chartThird).offsetWidth * 3 / 2
      });
    }
  }

  /**
   * Update state based on context changes
   * @param  {Object} nextProps   Incoming/Next properties
   * @param  {Object} nextContext Incoming/Next conext
   */
  componentWillReceiveProps(nextProps, nextContext) {
    if (this.context.route !== nextContext.route) {  // Only reinit state if the route has changed
      this.setState(this._initState(nextContext));
    }
  }

  /**
   * Add listeners when about to mount
   */
  componentWillMount() {
    this.resizeListener = this.context.onWindowResize(this._updateDimensions);
    document.addEventListener('keydown', this._keyDown);
  }

  /**
   * Trigger DOM updates on mount
   */
  componentDidMount() {
    this._updateDimensions();
  }

  /**
   * Remove listeners on unmount
   */
  componentWillUnmount() {
    this.resizeListener.remove();
  }

  /**
   * Generates the short URL
   */
  _genShortlink() {
    this.context.showModal(<ModalPermalink url={window.location.href}/>);
  }

  /**
   * Open up a window for EDDB with a shopping list of our components
   */
  _eddbShoppingList() {
    const ship = this.state.ship;

    const shipId = Ships[ship.id].eddbID;
    // Provide unique list of non-PP module EDDB IDs
    const modIds = ship.internal.concat(ship.bulkheads, ship.standard, ship.hardpoints).filter(slot => slot !== null && slot.m !== null && !slot.m.pp).map(slot => slot.m.eddbID).filter((v, i, a) => a.indexOf(v) === i);

    // Open up the relevant URL
    window.open('https://eddb.io/station?s=' + shipId + '&m=' + modIds.join(','));
  }

  /**
   * Handle Key Down
   * @param  {Event} e  Keyboard Event
   */
  _keyDown(e) {
    // .keyCode will eventually be replaced with .key
    switch (e.keyCode) {
      case 69:     // 'e'
        if (e.ctrlKey || e.metaKey) { // CTRL/CMD + e
          e.preventDefault();
          this._exportBuild();
        }
        break;
    }
  }

  /**
   * Render the Page
   * @return {React.Component} The page contents
   */
  renderPage() {
    let state = this.state,
        { language, termtip, tooltip, sizeRatio, onWindowResize } = this.context,
        { translate, units, formats } = language,
        { ship, code, savedCode, buildName, newBuildName, halfChartWidth, thirdChartWidth } = state,
        hide = tooltip.bind(null, null),
        menu = this.props.currentMenu,
        shipUpdated = this._shipUpdated,
        canSave = (newBuildName || buildName) && code !== savedCode,
        canRename = buildName && newBuildName && buildName != newBuildName,
        canReload = savedCode && canSave,
        hStr = ship.getHardpointsString() + '.' + ship.getModificationsString(),
        iStr = ship.getInternalString() + '.' + ship.getModificationsString();

    // Code can be blank for a default loadout.  Prefix it with the ship name to ensure that changes in default ships is picked up
    code = ship.name + (code || '');

    return (
      <div id='outfit' className={'page'} style={{ fontSize: (sizeRatio * 0.9) + 'em' }}>
        <div id='overview'>
          <h1>{ship.name}</h1>
          <div id='build'>
            <input value={newBuildName || ''} onChange={this._buildNameChange} placeholder={translate('Enter Name')} maxLength={50} />
            <button onClick={canSave && this._saveBuild} disabled={!canSave} onMouseOver={termtip.bind(null, 'save')} onMouseOut={hide}>
              <FloppyDisk className='lg' />
            </button>
            <button onClick={canRename && this._renameBuild} disabled={!canRename} onMouseOver={termtip.bind(null, 'rename')} onMouseOut={hide}>
            <span style={{ textTransform: 'none', fontSize: '1.8em' }}>a|</span>
            </button>
            <button onClick={canReload && this._reloadBuild} disabled={!canReload} onMouseOver={termtip.bind(null, 'reload')} onMouseOut={hide}>
              <Reload className='lg'/>
            </button>
            <button className={'danger'} onClick={savedCode && this._deleteBuild} disabled={!savedCode} onMouseOver={termtip.bind(null, 'delete')} onMouseOut={hide}>
              <Bin className='lg'/>
            </button>
            <button onClick={code && this._resetBuild} disabled={!code} onMouseOver={termtip.bind(null, 'reset')} onMouseOut={hide}>
              <Switch className='lg'/>
            </button>
            <button onClick={buildName && this._exportBuild} disabled={!buildName} onMouseOver={termtip.bind(null, 'export')} onMouseOut={hide}>
              <Download className='lg'/>
            </button>
            <button onClick={this._eddbShoppingList} onMouseOver={termtip.bind(null, 'PHRASE_SHOPPING_LIST')} onMouseOut={hide}>
              <ShoppingIcon className='lg' />
            </button>
            <button onClick={this._genShortlink} onMouseOver={termtip.bind(null, 'shortlink')} onMouseOut={hide}>
              <LinkIcon className='lg' />
            </button>
          </div>
        </div>

        <ShipSummaryTable ship={ship} code={code} />
        <StandardSlotSection ship={ship} code={code} onChange={shipUpdated} currentMenu={menu} />
        <InternalSlotSection ship={ship} code={iStr} onChange={shipUpdated} currentMenu={menu} />
        <HardpointsSlotSection ship={ship} code={hStr || ''} onChange={shipUpdated} currentMenu={menu} />
        <UtilitySlotSection ship={ship} code={hStr || ''} onChange={shipUpdated} currentMenu={menu} />

        <div ref='chartThird' className='group third'>
          <OffenceSummary ship={ship} code={code}/>
        </div>
        <div className='group third'>
          <DefenceSummary ship={ship} code={code}/>
        </div>
        <div className='group third'>
          <MovementSummary ship={ship} code={code}/>
        </div>

        <PowerManagement ship={ship} code={code} onChange={shipUpdated} />
        <CostSection ship={ship} buildName={buildName} code={code} />

        <div className='group third'>
          <EngineProfile ship={ship} code={code} chartWidth={thirdChartWidth} />
        </div>

        <div className='group third'>
          <FSDProfile ship={ship} code={code} chartWidth={thirdChartWidth} />
        </div>

        <div className='group third'>
          <JumpRange ship={ship} code={code} chartWidth={thirdChartWidth} />
        </div>

        <div>
          <DamageDealt ship={ship} code={code} chartWidth={halfChartWidth} currentMenu={menu}/>
        </div>

        <div>
          <DamageReceived ship={ship} code={code} currentMenu={menu}/>
        </div>
      </div>

    );
  }
}
